import { buildSearchResource, enforceSearchDeadlines } from '@isp-search/db';
import { toLoggableError } from '@isp-search/observability';

import {
  allowRequest,
  clientKey,
  errorResponse,
  jsonResponse,
} from '../../../../lib/server/api-http';
import { getDatabase } from '../../../../lib/server/db';
import { getWebEnv } from '../../../../lib/server/env';
import { getLogger } from '../../../../lib/server/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/searches/:id (PLA-368): the progressive polling resource. Unknown, malformed, and
 * genuinely absent ids are indistinguishable (`not_found`); possession of the 256-bit id is
 * the read capability.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const env = getWebEnv();
  if (!allowRequest(`read:${clientKey(request)}`, env.SEARCH_READ_RATE_PER_MINUTE)) {
    return errorResponse('rate_limited');
  }
  const { id } = await context.params;
  const handle = getDatabase();
  const now = new Date();
  try {
    // Lazy deadline enforcement keeps polls truthful even if the worker's sweep lags.
    const result = await buildSearchResource(handle, id, now);
    if (result.kind === 'not_found') return errorResponse('not_found');
    if (result.kind === 'expired') return errorResponse('expired');
    if (
      (result.resource.state === 'qualifying' || result.resource.state === 'partial') &&
      now.getTime() >= new Date(result.resource.deadlineAt).getTime()
    ) {
      await enforceSearchDeadlines(handle, now);
      const refreshed = await buildSearchResource(handle, id, now);
      if (refreshed.kind === 'ok') return jsonResponse(refreshed.resource);
    }
    return jsonResponse(result.resource);
  } catch (error) {
    getLogger().error({ err: toLoggableError(error) }, 'search read failed');
    return errorResponse('internal');
  }
}

/**
 * DELETE /api/searches/:id: internal/authorized deletion (ADR-007). Enabled only when
 * INTERNAL_ADMIN_TOKEN is configured; deletion cascades to jobs, offers, and material.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const env = getWebEnv();
  const token = env.INTERNAL_ADMIN_TOKEN;
  const presented = request.headers.get('authorization');
  if (token === undefined || presented !== `Bearer ${token}`) {
    // Indistinguishable from an unknown resource; the operation does not advertise itself.
    return errorResponse('not_found');
  }
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(id)) return errorResponse('not_found');
  const handle = getDatabase();
  const result = await handle.pool.query('delete from searches where id = $1', [id]);
  if (result.rowCount === 0) return errorResponse('not_found');
  await handle.pool.query(
    `insert into retention_events (data_class, sweep_run_id, search_id, deleted_count, trigger)
     values ('expired_search', 'admin_delete', $1, 1, 'manual')`,
    [id],
  );
  return jsonResponse({ deleted: true }, 200);
}

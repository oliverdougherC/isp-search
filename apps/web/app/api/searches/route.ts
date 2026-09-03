import { createSearchSession, startQualification } from '@isp-search/db';
import { SearchCreated, SearchSubmission, type SearchCreated as Created } from '@isp-search/domain';
import { toLoggableError } from '@isp-search/observability';
import { ResolverUnavailableError } from '@isp-search/resolver';

import {
  allowRequest,
  clientKey,
  errorResponse,
  jsonResponse,
  readJsonBody,
} from '../../../lib/server/api-http';
import { getDatabase } from '../../../lib/server/db';
import { getWebEnv } from '../../../lib/server/env';
import { getLogger } from '../../../lib/server/logger';
import { ensureQueueStarted, getSearchCore } from '../../../lib/server/search-core';

export const dynamic = 'force-dynamic';

/**
 * POST /api/searches (PLA-368): consented address submission. The address exists only in the
 * request body; the response carries an opaque high-entropy id and typed state. Never log the
 * body.
 */
export async function POST(request: Request): Promise<Response> {
  const env = getWebEnv();
  if (!allowRequest(`create:${clientKey(request)}`, env.SEARCH_CREATE_RATE_PER_MINUTE)) {
    return errorResponse('rate_limited');
  }
  const read = await readJsonBody(request);
  if (read.kind === 'too_large') return errorResponse('payload_too_large');
  if (read.kind === 'invalid') return errorResponse('invalid_request');
  const parsed = SearchSubmission.safeParse(read.body);
  if (!parsed.success) return errorResponse('invalid_request');

  const core = getSearchCore();
  const handle = getDatabase();
  const now = new Date();
  try {
    await ensureQueueStarted();
    const resolved = await core.resolver.resolve(
      {
        line1: parsed.data.address.line1,
        unit: parsed.data.address.unit,
        city: parsed.data.address.city,
        region: parsed.data.address.region,
        postalCode: parsed.data.address.postalCode,
      },
      { now: () => now },
    );
    const created = await createSearchSession(handle.db, {
      resolved,
      policy: { ...core.policy, consentVersion: parsed.data.consentVersion },
      now,
    });
    if (created.state === 'resolving_address') {
      await startQualification(handle, created.searchId, core.orchestration);
    }
    const requiredAction =
      created.state === 'address_action_required'
        ? ((resolved.validationState === 'ambiguous'
            ? 'select_candidate'
            : resolved.validationState === 'validated_unit_missing'
              ? 'provide_unit'
              : 'correct_input') as Created['requiredAction'])
        : null;
    const response: Created = SearchCreated.parse({
      apiVersion: 1,
      id: created.searchId,
      state:
        created.state === 'resolving_address'
          ? // report the post-fan-out state so clients can poll immediately
            'qualifying'
          : created.state,
      requiredAction,
      pollIntervalMs: 1_000,
      deadlineAt: created.deadlineAt.toISOString(),
      expiresAt: created.expiresAt.toISOString(),
    });
    return jsonResponse(response, 201);
  } catch (error) {
    if (error instanceof ResolverUnavailableError) {
      // Typed reason only; nothing derived from the address.
      getLogger().error({ reason: error.reason }, 'resolver unavailable');
      return errorResponse('internal');
    }
    getLogger().error({ err: toLoggableError(error) }, 'search creation failed');
    return errorResponse('internal');
  }
}

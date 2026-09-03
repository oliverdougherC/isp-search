import {
  applyAddressAction,
  ProviderActionError,
  SearchActionError,
  startQualification,
  submitProviderAction,
} from '@isp-search/db';
import { SearchActionSubmission, type PublicErrorCode } from '@isp-search/domain';
import { toLoggableError } from '@isp-search/observability';

import {
  allowRequest,
  clientKey,
  errorResponse,
  jsonResponse,
  readJsonBody,
} from '../../../../../lib/server/api-http';
import { getDatabase } from '../../../../../lib/server/db';
import { getWebEnv } from '../../../../../lib/server/env';
import { getLogger } from '../../../../../lib/server/logger';
import { ensureQueueStarted, getSearchCore } from '../../../../../lib/server/search-core';

export const dynamic = 'force-dynamic';

const CODE_FOR_FAILURE: Readonly<Record<string, PublicErrorCode>> = {
  not_found: 'not_found',
  expired: 'expired',
  action_not_allowed: 'action_not_allowed',
  conflict: 'conflict',
  invalid_action: 'invalid_request',
};

/**
 * POST /api/searches/:id/actions (PLA-364/368): address-level actions (candidate selection,
 * unit supply, correction) and provider-level unit/building choices. Epoch-guarded; stale or
 * repeated submissions are typed rejections.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const env = getWebEnv();
  if (!allowRequest(`action:${clientKey(request)}`, env.SEARCH_CREATE_RATE_PER_MINUTE)) {
    return errorResponse('rate_limited');
  }
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(id)) return errorResponse('not_found');
  const read = await readJsonBody(request);
  if (read.kind === 'too_large') return errorResponse('payload_too_large');
  if (read.kind === 'invalid') return errorResponse('invalid_request');
  const parsed = SearchActionSubmission.safeParse(read.body);
  if (!parsed.success) return errorResponse('invalid_request');

  const core = getSearchCore();
  const handle = getDatabase();
  const now = new Date();
  try {
    await ensureQueueStarted();
    const action = parsed.data;
    if (action.type === 'provider_choice') {
      const result = await submitProviderAction(handle, core.queue, {
        searchId: id,
        providerId: action.providerId,
        choice: action.choice,
        now,
      });
      return jsonResponse({ apiVersion: 1, providerId: action.providerId, ...result });
    }
    const applied = await applyAddressAction(
      handle,
      id,
      action.type === 'select_candidate'
        ? { type: 'select_candidate', candidateId: action.candidateId, epoch: action.epoch }
        : action.type === 'provide_unit'
          ? { type: 'provide_unit', unit: action.unit, epoch: action.epoch }
          : {
              type: 'correct_input',
              line1: action.address.line1,
              unit: action.address.unit,
              city: action.address.city,
              region: action.address.region,
              postalCode: action.address.postalCode,
              epoch: action.epoch,
            },
      {
        policy: core.policy,
        now,
        resolve: (input) => core.resolver.resolve(input, { now: () => now }),
      },
    );
    if (applied.state === 'resolving_address') {
      await startQualification(handle, id, core.orchestration);
    }
    return jsonResponse({
      apiVersion: 1,
      state: applied.state === 'resolving_address' ? 'qualifying' : applied.state,
      requiredAction: applied.requiredAction,
      actionEpoch: applied.actionEpoch,
    });
  } catch (error) {
    if (error instanceof SearchActionError || error instanceof ProviderActionError) {
      return errorResponse(CODE_FOR_FAILURE[error.code] ?? 'invalid_request');
    }
    getLogger().error({ err: toLoggableError(error) }, 'search action failed');
    return errorResponse('internal');
  }
}

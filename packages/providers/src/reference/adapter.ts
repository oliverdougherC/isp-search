import { isSyntheticAddress } from '@isp-search/domain';

import type {
  AdapterContext,
  ProviderAdapter,
  QualificationEvidence,
  QualificationRequest,
  QualificationResult,
} from '../contract.js';
import { loadReferenceFixture, type ReferenceFixture } from '../fixtures.js';

export const REFERENCE_ADAPTER_VERSION = '1.0.0';
export const REFERENCE_PARSER_VERSION = '1.0.0';

export interface ReferenceAdapterOptions {
  readonly providerId: string;
  /** Path relative to `packages/providers/fixtures`. */
  readonly fixturePath: string;
}

/**
 * Deterministic reference adapter. Its outcome is entirely determined by a committed synthetic
 * fixture, so orchestration, retry, and UI code can be exercised for every core outcome with no
 * network and no real provider. Scenario controls carried in fixture diagnostics:
 *
 *  - `delay_ms`: finish after a delay (progressive/slow-provider scenarios);
 *  - `sleep_past_deadline_ms`: finish that long AFTER the request deadline (late-result rule);
 *  - `succeeds_from_attempt`: for `rate_limited`, succeed once `request.attempt` reaches it.
 *
 * A `unit_required`/`address_ambiguous` scenario completes once `request.actionResponse` is
 * present (the user answered this provider's own question).
 *
 * Safety property: it refuses non-synthetic addresses, so it can never be pointed at a real
 * address by mistake in a test.
 */
export function createReferenceAdapter(options: ReferenceAdapterOptions): ProviderAdapter {
  return {
    id: `reference:${options.providerId}`,
    version: REFERENCE_ADAPTER_VERSION,
    providerId: options.providerId,
    tier: 'reference_fixture',
    async qualify(
      request: QualificationRequest,
      context: AdapterContext,
    ): Promise<QualificationResult> {
      if (!isSyntheticAddress(request.address)) {
        return {
          outcome: 'invalid_response',
          evidence: null,
          diagnostics: { code: 'reference_adapter_requires_synthetic_address' },
        };
      }
      if (new Date(request.deadlineAt).getTime() <= context.now().getTime()) {
        return { outcome: 'timeout', evidence: null, diagnostics: { code: 'deadline_elapsed' } };
      }
      const load = loadReferenceFixture(options.fixturePath);
      if (!load.ok) {
        const outcome =
          load.error.reason === 'fingerprint_mismatch' ? 'upstream_changed' : 'parse_error';
        return { outcome, evidence: null, diagnostics: { code: load.error.reason } };
      }
      await applyScenarioDelay(load.fixture, request, context);
      return buildResult(load.fixture, request);
    },
  };
}

async function applyScenarioDelay(
  fixture: ReferenceFixture,
  request: QualificationRequest,
  context: AdapterContext,
): Promise<void> {
  const sleep =
    context.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const diagnostics = fixture.body.diagnostics ?? {};
  const delayMs = diagnostics['delay_ms'];
  if (typeof delayMs === 'number' && delayMs > 0) {
    await sleep(delayMs);
  }
  const pastDeadlineMs = diagnostics['sleep_past_deadline_ms'];
  if (typeof pastDeadlineMs === 'number') {
    const wakeAt = new Date(request.deadlineAt).getTime() + pastDeadlineMs;
    const waitMs = wakeAt - context.now().getTime();
    if (waitMs > 0) await sleep(waitMs);
  }
}

function buildResult(
  fixture: ReferenceFixture,
  request: QualificationRequest,
): QualificationResult {
  const { metadata, body } = fixture;
  const evidence: QualificationEvidence = {
    sourceType: 'synthetic',
    capturedAt: metadata.capturedAt,
    adapterVersion: REFERENCE_ADAPTER_VERSION,
    parserVersion: metadata.parserVersion,
    fingerprint: metadata.fingerprint,
  };
  // Resume flow (PLA-364): once the user answered this provider's unit/building question,
  // the deterministic scenario completes successfully.
  if (
    (body.outcome === 'unit_required' || body.outcome === 'address_ambiguous') &&
    request.actionResponse !== undefined
  ) {
    return { outcome: 'available', evidence, diagnostics: { code: 'resumed_after_action' } };
  }
  // Transient scenario: rate limited until the configured attempt is reached.
  const succeedsFrom = body.diagnostics?.['succeeds_from_attempt'];
  if (
    body.outcome === 'rate_limited' &&
    typeof succeedsFrom === 'number' &&
    request.attempt >= succeedsFrom
  ) {
    return { outcome: 'available', evidence, diagnostics: { code: 'succeeded_after_retry' } };
  }
  return {
    outcome: body.outcome,
    evidence,
    ...(body.actionOptions ? { actionOptions: body.actionOptions } : {}),
    diagnostics: body.diagnostics ?? {},
  };
}

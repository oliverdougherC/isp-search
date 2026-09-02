import { isSyntheticAddress } from '@isp-search/domain';

import type {
  AdapterContext,
  ProviderAdapter,
  QualificationRequest,
  QualificationResult,
} from '../contract.js';
import { loadReferenceFixture } from '../fixtures.js';

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
 * network and no real provider.
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
    qualify(request: QualificationRequest, context: AdapterContext): Promise<QualificationResult> {
      return Promise.resolve(qualifySync(request, context, options));
    },
  };
}

function qualifySync(
  request: QualificationRequest,
  context: AdapterContext,
  options: ReferenceAdapterOptions,
): QualificationResult {
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
  const { metadata, body } = load.fixture;
  return {
    outcome: body.outcome,
    evidence: {
      sourceType: 'synthetic',
      capturedAt: metadata.capturedAt,
      adapterVersion: REFERENCE_ADAPTER_VERSION,
      parserVersion: metadata.parserVersion,
      fingerprint: metadata.fingerprint,
    },
    ...(body.actionOptions ? { actionOptions: body.actionOptions } : {}),
    diagnostics: body.diagnostics ?? {},
  };
}

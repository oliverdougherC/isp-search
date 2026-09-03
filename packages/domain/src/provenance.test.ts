import { describe, expect, it } from 'vitest';

import { CandidateEvidence } from './candidate.js';
import { computeFreshness } from './provenance.js';

const policy = { staleAfterMs: 1000, expireAfterMs: 5000 };

describe('computeFreshness', () => {
  it('is fresh, then stale, then expired, deterministically', () => {
    const retrieved = new Date('2026-09-03T00:00:00.000Z');
    const at = (ms: number) => new Date(retrieved.getTime() + ms);
    expect(computeFreshness(retrieved, policy, at(0))).toBe('fresh');
    expect(computeFreshness(retrieved, policy, at(999))).toBe('fresh');
    expect(computeFreshness(retrieved, policy, at(1000))).toBe('stale');
    expect(computeFreshness(retrieved, policy, at(4999))).toBe('stale');
    expect(computeFreshness(retrieved, policy, at(5000))).toBe('expired');
  });
});

describe('CandidateEvidence precision guard', () => {
  const base = {
    schemaVersion: 1,
    providerId: 'reference-available',
    evidenceClass: 'area_level_reported',
    technologies: ['fiber'],
    registryVersion: 'dev-0',
    capacityBasedEligibility: false,
    provenance: {
      schemaVersion: 1,
      sourceType: 'launch_registry',
      sourceDomain: 'example.com',
      sourceUrl: null,
      retrievedAt: '2026-09-03T00:00:00.000Z',
      dataVintage: '2025-12-31',
      lastReviewed: '2026-09-02',
      geographicPrecision: 'market',
      adapterVersion: null,
      parserVersion: null,
      contentHash: null,
      limitations: ['candidates only; the provider confirms serviceability'],
    },
  } as const;

  it('accepts market-precision registry evidence', () => {
    expect(CandidateEvidence.safeParse(base).success).toBe(true);
  });

  it('rejects address-precision evidence from a non-licensed source', () => {
    const invalid = {
      ...base,
      provenance: { ...base.provenance, geographicPrecision: 'address' },
    };
    expect(CandidateEvidence.safeParse(invalid).success).toBe(false);
  });

  it('candidate evidence can never carry the provider_qualification class', () => {
    const invalid = { ...base, evidenceClass: 'provider_qualification' };
    expect(CandidateEvidence.safeParse(invalid).success).toBe(false);
  });
});

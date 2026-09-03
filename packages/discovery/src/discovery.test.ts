import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CandidateEvidence, mapCandidateEvidenceToAvailability } from '@isp-search/domain';
import { describe, expect, it } from 'vitest';

import { createRegistryCandidateDiscovery, DiscoveryUnavailableError } from './discovery.js';
import { loadBundledRegistry } from './registry-files.js';
import { LaunchRegistry } from './registry-schema.js';

const NOW = new Date('2026-09-10T00:00:00.000Z');

const syntheticScope = { region: 'ZZ', countyFips: null, cbsaGeoid: 'synthetic-zz' } as const;

function syntheticDiscovery() {
  return createRegistryCandidateDiscovery({
    loadRegistry: () => Promise.resolve(loadBundledRegistry('synthetic-dev')),
  });
}

describe('bundled registries', () => {
  it('both bundled registries validate against the schema', () => {
    expect(loadBundledRegistry('proposed').status).toBe('proposed_pending_maintainer_confirmation');
    expect(loadBundledRegistry('synthetic-dev').status).toBe('development_only');
  });

  it('the bundled proposed registry is byte-identical to the reviewed launch matrix', () => {
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const bundled: unknown = JSON.parse(
      readFileSync(resolve(packageRoot, 'registry', 'proposed.json'), 'utf8'),
    );
    const reviewed: unknown = JSON.parse(
      readFileSync(
        resolve(packageRoot, '..', '..', 'docs', 'sources', 'launch-matrix.json'),
        'utf8',
      ),
    );
    expect(bundled).toEqual(reviewed);
  });

  it('a synthetic market cannot appear outside a development-only registry', () => {
    const registry = loadBundledRegistry('synthetic-dev');
    const invalid = { ...registry, status: 'approved' };
    expect(LaunchRegistry.safeParse(invalid).success).toBe(false);
  });

  it('a market cannot claim approval inside a proposed registry', () => {
    const registry = loadBundledRegistry('proposed');
    const invalid = {
      ...registry,
      markets: registry.markets.map((market, index) =>
        index === 0 ? { ...market, status: 'approved' } : market,
      ),
    };
    expect(LaunchRegistry.safeParse(invalid).success).toBe(false);
  });
});

describe('RegistryCandidateDiscovery', () => {
  it('returns the synthetic market with all twelve reference candidates', async () => {
    const result = await syntheticDiscovery().discover({ scope: syntheticScope, now: NOW });
    if (result.status !== 'supported') throw new Error('expected supported market');
    expect(result.market.id).toBe('synthetic-zz');
    expect(result.market.status).toBe('development_only');
    expect(result.candidates).toHaveLength(12);
    expect(result.registryStale).toBe(false);
  });

  it('every candidate evidence validates and can never map to a verified state', async () => {
    const result = await syntheticDiscovery().discover({ scope: syntheticScope, now: NOW });
    if (result.status !== 'supported') throw new Error('expected supported market');
    for (const candidate of result.candidates) {
      for (const evidence of candidate.evidence) {
        const parsed = CandidateEvidence.parse(evidence);
        const availability = mapCandidateEvidenceToAvailability(parsed.evidenceClass);
        expect(availability).not.toBe('verified_available');
        expect(availability).not.toBe('verified_unavailable');
        expect(parsed.provenance.geographicPrecision).not.toBe('address');
      }
    }
  });

  it('an unsupported scope returns the boundary disclosure and the FCC map link, never candidates', async () => {
    const result = await syntheticDiscovery().discover({
      scope: { region: 'WA', countyFips: '53033', cbsaGeoid: '99999' },
      now: NOW,
    });
    expect(result.status).toBe('unsupported_market');
    if (result.status !== 'unsupported_market') throw new Error('unreachable');
    expect(result.fccMapUrl).toBe('https://broadbandmap.fcc.gov/');
    expect(result.lastReviewed).toBeTruthy();
    expect('candidates' in result).toBe(false);
  });

  it('membership is decided by explicit CBSA/county geography, not by region or ZIP prefix', async () => {
    const discovery = createRegistryCandidateDiscovery({
      loadRegistry: () => Promise.resolve(loadBundledRegistry('proposed')),
    });
    const seattle = await discovery.discover({
      scope: { region: 'WA', countyFips: null, cbsaGeoid: '42660' },
      now: NOW,
    });
    expect(seattle.status).toBe('supported');
    // Same state, different CBSA: not supported.
    const spokane = await discovery.discover({
      scope: { region: 'WA', countyFips: '53063', cbsaGeoid: '44060' },
      now: NOW,
    });
    expect(spokane.status).toBe('unsupported_market');
    // No resolved CBSA/county at all: never guessed from the region.
    const vague = await discovery.discover({
      scope: { region: 'WA', countyFips: null, cbsaGeoid: null },
      now: NOW,
    });
    expect(vague.status).toBe('unsupported_market');
  });

  it('excludes providers whose listing is blocked until evidence exists', async () => {
    const discovery = createRegistryCandidateDiscovery({
      loadRegistry: () => Promise.resolve(loadBundledRegistry('proposed')),
    });
    const seattle = await discovery.discover({
      scope: { region: 'WA', countyFips: null, cbsaGeoid: '42660' },
      now: NOW,
    });
    if (seattle.status !== 'supported') throw new Error('expected supported market');
    const ids = seattle.candidates.map((candidate) => candidate.providerId);
    expect(ids).toContain('ziply-fiber');
    expect(ids).not.toContain('xfinity');
    expect(ids).not.toContain('quantum-fiber');
    expect(seattle.market.status).toBe('proposed');
  });

  it('marks a stale registry without dropping candidates', async () => {
    const result = await syntheticDiscovery().discover({
      scope: syntheticScope,
      now: new Date('2027-06-01T00:00:00.000Z'),
    });
    if (result.status !== 'supported') throw new Error('expected supported market');
    expect(result.registryStale).toBe(true);
    expect(result.candidates.length).toBeGreaterThan(0);
    const [first] = result.candidates;
    expect(first?.evidence[0]?.provenance.limitations.join(' ')).toContain('stale');
  });

  it('a registry outage raises a typed error instead of fabricating candidates', async () => {
    const discovery = createRegistryCandidateDiscovery({
      loadRegistry: () => Promise.reject(new Error('boom')),
    });
    await expect(discovery.discover({ scope: syntheticScope, now: NOW })).rejects.toBeInstanceOf(
      DiscoveryUnavailableError,
    );
  });

  it('capacity-based providers carry the capacity limitation', async () => {
    const result = await syntheticDiscovery().discover({ scope: syntheticScope, now: NOW });
    if (result.status !== 'supported') throw new Error('expected supported market');
    const rateLimited = result.candidates.find(
      (candidate) => candidate.providerId === 'reference-rate-limited',
    );
    expect(rateLimited?.capacityBasedEligibility).toBe(true);
    expect(rateLimited?.evidence[0]?.provenance.limitations.join(' ')).toContain('capacity');
  });
});

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { computeFixtureFingerprint, fixturesRoot, loadReferenceFixture } from './fixtures.js';

describe('fixture fingerprint', () => {
  it('depends on shape, not on values', () => {
    const a = computeFixtureFingerprint({ outcome: 'available', diagnostics: { a: 1 } });
    const b = computeFixtureFingerprint({ outcome: 'unavailable', diagnostics: { a: 2 } });
    const c = computeFixtureFingerprint({
      outcome: 'available',
      diagnostics: { a: 1, extra: true },
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('loadReferenceFixture', () => {
  it('reports a fingerprint mismatch as a typed error', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fixture-'));
    const path = join(dir, 'tampered.json');
    writeFileSync(
      path,
      JSON.stringify({
        metadata: {
          sourceType: 'synthetic',
          capturedAt: '2026-09-02T00:00:00.000Z',
          adapterVersion: '1.0.0',
          parserVersion: '1.0.0',
          sanitation: 'synthetic',
          fingerprint: `sha256:${'0'.repeat(64)}`,
        },
        body: { outcome: 'available' },
      }),
    );
    const load = loadReferenceFixture(relative(fixturesRoot(), path));
    expect(load.ok).toBe(false);
    if (!load.ok) expect(load.error.reason).toBe('fingerprint_mismatch');
  });

  it('reports missing files without throwing', () => {
    const load = loadReferenceFixture('reference/does-not-exist.json');
    expect(load.ok).toBe(false);
    if (!load.ok) expect(load.error.reason).toBe('unreadable');
  });
});

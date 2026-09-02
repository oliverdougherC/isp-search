import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AdapterOutcome } from '@isp-search/domain';
import { z } from 'zod';

/**
 * Sanitized fixture format (docs/security/fixture-sanitation.md).
 *
 * Every committed fixture carries provenance metadata so reviewers can tell where a shape came
 * from and which parser version it exercises. Bodies never contain a real address, cookie,
 * token, or unredacted provider response. The `fingerprint` is a hash of the *shape*, computed
 * by `computeFixtureFingerprint`, and adapters compare it against what they expect so that a
 * silently edited fixture surfaces as `upstream_changed` instead of passing.
 */
export const FixtureMetadata = z
  .object({
    sourceType: z.enum(['synthetic', 'sanitized_capture']),
    capturedAt: z.iso.datetime(),
    adapterVersion: z.string().min(1),
    parserVersion: z.string().min(1),
    /** Human note on how the fixture was produced and what was removed. */
    sanitation: z.string().min(1),
    fingerprint: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  })
  .strict();
export type FixtureMetadata = z.infer<typeof FixtureMetadata>;

export const ReferenceFixtureBody = z
  .object({
    outcome: AdapterOutcome,
    actionOptions: z.array(z.string()).optional(),
    diagnostics: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  })
  .strict();
export type ReferenceFixtureBody = z.infer<typeof ReferenceFixtureBody>;

export const ReferenceFixture = z
  .object({
    metadata: FixtureMetadata,
    body: ReferenceFixtureBody,
  })
  .strict();
export type ReferenceFixture = z.infer<typeof ReferenceFixture>;

export function fixturesRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
}

/** Shape fingerprint: sorted key paths plus value types, never values. */
export function computeFixtureFingerprint(body: unknown): string {
  const paths: string[] = [];
  const walk = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      paths.push(`${path}:array`);
      for (const item of value) walk(item, `${path}[]`);
      return;
    }
    if (value !== null && typeof value === 'object') {
      paths.push(`${path}:object`);
      for (const key of Object.keys(value).sort()) {
        walk((value as Record<string, unknown>)[key], `${path}.${key}`);
      }
      return;
    }
    paths.push(`${path}:${typeof value}`);
  };
  walk(body, '$');
  const digest = createHash('sha256').update(paths.sort().join('\n')).digest('hex');
  return `sha256:${digest}`;
}

export type FixtureLoadFailure =
  'unreadable' | 'malformed_json' | 'schema_invalid' | 'fingerprint_mismatch';

export class FixtureLoadError extends Error {
  override readonly name = 'FixtureLoadError';
  readonly relativePath: string;
  readonly reason: FixtureLoadFailure;
  constructor(relativePath: string, reason: FixtureLoadFailure) {
    super(`fixture ${relativePath}: ${reason}`);
    this.relativePath = relativePath;
    this.reason = reason;
  }
}

export type FixtureLoad =
  | { readonly ok: true; readonly fixture: ReferenceFixture }
  | { readonly ok: false; readonly error: FixtureLoadError };

/** Loads and validates a reference fixture; never throws on bad fixtures, returns a typed error. */
export function loadReferenceFixture(relativePath: string): FixtureLoad {
  let raw: string;
  try {
    raw = readFileSync(resolve(fixturesRoot(), relativePath), 'utf8');
  } catch {
    return { ok: false, error: new FixtureLoadError(relativePath, 'unreadable') };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: new FixtureLoadError(relativePath, 'malformed_json') };
  }
  const result = ReferenceFixture.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: new FixtureLoadError(relativePath, 'schema_invalid') };
  }
  if (computeFixtureFingerprint(result.data.body) !== result.data.metadata.fingerprint) {
    return { ok: false, error: new FixtureLoadError(relativePath, 'fingerprint_mismatch') };
  }
  return { ok: true, fixture: result.data };
}

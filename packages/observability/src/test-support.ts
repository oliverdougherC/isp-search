import { Writable } from 'node:stream';

/**
 * Canary values used by privacy tests across the repository. They are intentionally
 * recognizable and intentionally fake. If any of them ever appears in a log, an error
 * payload, a fixture, or a built client bundle, a privacy invariant has been broken.
 */
export const CANARIES = {
  streetLine: '1234 Canary Street',
  unit: 'Apt 9Z',
  fullAddress: '1234 Canary Street Apt 9Z, Fixtureville, ZZ 00042',
  secret: 'CANARY-SECRET-0f9e8d7c6b5a49382716',
  cookie: 'canary_session=CANARY-COOKIE-a1b2c3d4e5f6',
  bearer: 'Bearer CANARY-TOKEN-aabbccddeeff00112233',
  jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJjYW5hcnkiOnRydWV9.CANARYSIGNATURE0123456789',
  email: 'canary.person@example.com',
  phone: '(206) 555-0142',
} as const;

export type CanaryName = keyof typeof CANARIES;

/** Returns the names of every canary whose value is present in `haystack`. */
export function findCanaries(haystack: string): CanaryName[] {
  return (Object.keys(CANARIES) as CanaryName[]).filter((name) =>
    haystack.includes(CANARIES[name]),
  );
}

/** Collects logger output in memory for assertions. */
export function captureStream(): { readonly stream: Writable; readonly output: () => string } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  return { stream, output: () => chunks.join('') };
}

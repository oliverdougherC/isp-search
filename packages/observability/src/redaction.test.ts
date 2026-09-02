import { describe, expect, it } from 'vitest';

import { REDACTED, redactText, redactValue } from './redaction.js';
import { CANARIES, findCanaries } from './test-support.js';

describe('redactText', () => {
  it('removes street addresses with and without units', () => {
    const text = `job for ${CANARIES.fullAddress} started`;
    const redacted = redactText(text);
    expect(findCanaries(redacted)).toEqual([]);
    expect(redacted).toContain(REDACTED);
  });

  it('strips URL query strings but keeps the path', () => {
    const redacted = redactText('GET https://example.com/check?street=1234+Canary&zip=00042 done');
    expect(redacted).toBe(`GET https://example.com/check?${REDACTED} done`);
  });

  it('redacts bearer tokens, JWTs, cookies, emails, and phone numbers', () => {
    const text = [
      CANARIES.bearer,
      CANARIES.jwt,
      `Cookie: ${CANARIES.cookie}`,
      CANARIES.email,
      CANARIES.phone,
    ].join(' | ');
    expect(findCanaries(redactText(text))).toEqual([]);
  });

  it('leaves ordinary operational text alone', () => {
    const text = 'adapter=reference outcome=available latencyMs=42';
    expect(redactText(text)).toBe(text);
  });
});

describe('redactValue', () => {
  it('replaces sensitive keys wholesale regardless of value', () => {
    const value = redactValue({
      street: 'anything',
      unit: 'anything',
      cookie: 'anything',
      authorization: 'anything',
      rawPayload: { nested: 'anything' },
      safe: 'kept',
    }) as Record<string, unknown>;
    expect(value['street']).toBe(REDACTED);
    expect(value['unit']).toBe(REDACTED);
    expect(value['cookie']).toBe(REDACTED);
    expect(value['authorization']).toBe(REDACTED);
    expect(value['rawPayload']).toBe(REDACTED);
    expect(value['safe']).toBe('kept');
  });

  it('redacts string values nested in arrays and objects', () => {
    const value = redactValue({ notes: [`saw ${CANARIES.fullAddress}`, { deeper: CANARIES.jwt }] });
    expect(findCanaries(JSON.stringify(value))).toEqual([]);
  });

  it('handles cycles and depth without throwing', () => {
    const cyclic: Record<string, unknown> = { level: 1 };
    cyclic['self'] = cyclic;
    expect(() => redactValue(cyclic)).not.toThrow();
    expect(JSON.stringify(redactValue(cyclic))).toContain('[CIRCULAR]');
  });

  it('serializes errors with redacted message and stack', () => {
    const error = new Error(`failed at ${CANARIES.fullAddress} with ${CANARIES.bearer}`);
    const value = redactValue(error) as { message: string; stack?: string };
    expect(findCanaries(value.message)).toEqual([]);
    expect(findCanaries(value.stack ?? '')).toEqual([]);
  });
});

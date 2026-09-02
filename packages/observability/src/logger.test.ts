import { describe, expect, it } from 'vitest';

import { AppError, toSafeError } from './errors.js';
import { createLogger } from './logger.js';
import { CANARIES, captureStream, findCanaries } from './test-support.js';

describe('createLogger', () => {
  it('never emits canary addresses, secrets, cookies, or tokens in any position', () => {
    const { stream, output } = captureStream();
    const logger = createLogger({ name: 'test', level: 'trace', destination: stream });
    const child = logger.child({
      street: CANARIES.streetLine,
      requestQuery: `?q=${CANARIES.secret}`,
    });

    child.info(`message mentions ${CANARIES.fullAddress}`);
    child.warn({ address: CANARIES.fullAddress, unit: CANARIES.unit }, 'object fields');
    child.error({ err: new Error(`boom ${CANARIES.bearer}`) }, 'error field');
    child.debug({ headers: { cookie: CANARIES.cookie, 'set-cookie': CANARIES.cookie } }, 'headers');
    child.trace({ nested: { list: [CANARIES.jwt, { email: CANARIES.email }] } }, 'nested');
    child.info({ secretValue: CANARIES.secret }, 'secret');
    child.info(`token ${CANARIES.secret} phone ${CANARIES.phone}`);

    const text = output();
    expect(text.length).toBeGreaterThan(0);
    expect(findCanaries(text)).toEqual([]);
    // Structured output remains parseable JSON lines.
    for (const line of text.trim().split('\n')) {
      expect(() => {
        JSON.parse(line);
      }).not.toThrow();
    }
  });

  it('keeps operational fields intact', () => {
    const { stream, output } = captureStream();
    const logger = createLogger({ name: 'test', destination: stream });
    logger.info({ adapter: 'reference', outcome: 'available', latencyMs: 12 }, 'qualified');
    const line = JSON.parse(output().trim()) as Record<string, unknown>;
    expect(line['adapter']).toBe('reference');
    expect(line['latencyMs']).toBe(12);
    expect(line['msg']).toBe('qualified');
  });
});

describe('toSafeError', () => {
  it('collapses unknown errors to a generic message', () => {
    const safe = toSafeError(new Error(`provider said ${CANARIES.fullAddress}`), 'corr');
    expect(safe).toEqual({
      code: 'internal',
      message: 'An internal error occurred.',
      correlationId: 'corr',
    });
  });

  it('exposes only typed code and safe metadata for AppError', () => {
    const error = new AppError('invalid_request', `bad input ${CANARIES.fullAddress}`, {
      safeMetadata: { field: 'postalCode' },
      cause: { raw: CANARIES.secret },
    });
    const safe = toSafeError(error);
    expect(safe.code).toBe('invalid_request');
    expect(safe.metadata).toEqual({ field: 'postalCode' });
    expect(findCanaries(JSON.stringify(safe))).toEqual([]);
    expect(error.httpStatus).toBe(400);
  });
});

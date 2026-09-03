import { describe, expect, it } from 'vitest';

import { ConfigValidationError, loadWebServerEnv, loadWorkerEnv } from './server.js';

const SECRET_CANARY = 'CANARY-HMAC-SECRET-0123456789abcdef0123456789abcdef';
// secretlint-disable-next-line -- intentionally fake canary connection string
const DB_CANARY = 'postgres://canary_user:CANARY-DB-PASSWORD@localhost:5432/canary_db';

// 64 lowercase hex chars; intentionally fake.
const RAW_KEY_CANARY = 'deadbeef'.repeat(8);

const valid = {
  NODE_ENV: 'test',
  DATABASE_URL: DB_CANARY,
  ADDRESS_HMAC_SECRET: SECRET_CANARY,
  RAW_ADDRESS_ENCRYPTION_KEY: RAW_KEY_CANARY,
};

describe('loadWebServerEnv', () => {
  it('applies defaults and coerces numbers', () => {
    const env = loadWebServerEnv(valid);
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.ADDRESS_HMAC_KEY_VERSION).toBe(1);
    expect(env.DEBUG_CAPTURE_ENABLED).toBe(false);
  });

  it('fails startup with an actionable error listing every problem', () => {
    let caught: unknown;
    try {
      loadWebServerEnv({ NODE_ENV: 'production', PORT: 'abc' });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ConfigValidationError);
    const error = caught as ConfigValidationError;
    const variables = error.issues.map((issue) => issue.variable);
    expect(variables).toEqual(
      expect.arrayContaining(['DATABASE_URL', 'ADDRESS_HMAC_SECRET', 'PORT']),
    );
    expect(error.message).toContain('pnpm env:init');
  });

  it('never echoes values into the error message', () => {
    let message = '';
    try {
      loadWebServerEnv({
        ...valid,
        ADDRESS_HMAC_SECRET: 'too-short',
        DATABASE_URL: 'mysql://nope',
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toContain('too-short');
    expect(message).not.toContain('mysql://nope');
    expect(message).toContain('ADDRESS_HMAC_SECRET');
  });

  it('rejects a non-postgres database URL', () => {
    expect(() => loadWebServerEnv({ ...valid, DATABASE_URL: 'https://example.invalid' })).toThrow(
      ConfigValidationError,
    );
  });

  it('caps debug capture TTL at 24 hours', () => {
    expect(() =>
      loadWebServerEnv({ ...valid, DEBUG_CAPTURE_ENABLED: 'true', DEBUG_CAPTURE_TTL_HOURS: '48' }),
    ).toThrow(ConfigValidationError);
  });
});

describe('loadWorkerEnv', () => {
  it('validates queue schema identifiers', () => {
    expect(loadWorkerEnv(valid).JOB_QUEUE_SCHEMA).toBe('pgboss');
    expect(() => loadWorkerEnv({ ...valid, JOB_QUEUE_SCHEMA: 'Bad-Schema' })).toThrow(
      ConfigValidationError,
    );
  });
});

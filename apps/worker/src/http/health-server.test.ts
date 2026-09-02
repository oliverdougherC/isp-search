import type { AddressInfo } from 'node:net';

import { createLogger } from '@isp-search/observability';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHealthServer } from './health-server.js';

let baseUrl = '';
let server: ReturnType<typeof createHealthServer>;
let ready = true;

beforeAll(async () => {
  server = createHealthServer({
    port: 0,
    logger: createLogger({ name: 'test', level: 'silent' }),
    liveness: () => ({ status: 'ok', service: 'worker', uptimeSeconds: 1, shuttingDown: false }),
    readiness: () =>
      Promise.resolve({
        status: ready ? 'ready' : 'not_ready',
        checks: { database: ready ? 'ok' : 'error' },
      }),
  });
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) =>
    server.close(() => {
      resolve();
    }),
  );
});

describe('worker health server', () => {
  it('serves liveness', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok', service: 'worker' });
  });

  it('serves readiness and reflects failures with 503', async () => {
    ready = true;
    expect((await fetch(`${baseUrl}/ready`)).status).toBe(200);
    ready = false;
    expect((await fetch(`${baseUrl}/ready`)).status).toBe(503);
  });

  it('rejects other methods and paths', async () => {
    expect((await fetch(`${baseUrl}/health`, { method: 'POST' })).status).toBe(405);
    expect((await fetch(`${baseUrl}/nope`)).status).toBe(404);
  });
});

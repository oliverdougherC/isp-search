import { describe, expect, it } from 'vitest';

import { GET } from './route';

describe('GET /api/health', () => {
  it('returns liveness without configuration details', async () => {
    const response = GET();
    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(body['status']).toBe('ok');
    expect(Object.keys(body).sort()).toEqual(['service', 'status', 'time']);
  });
});

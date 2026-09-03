import { randomBytes } from 'node:crypto';

import { SearchResource } from '@isp-search/domain';
import { CANARIES } from '@isp-search/observability/test-support';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * API contract proofs (PLA-368) against the real route handlers and a throwaway database.
 * The worker is deliberately NOT running: jobs stay queued, which is exactly what a client
 * sees mid-search.
 */
const base = process.env['DATABASE_URL_TEST'] ?? process.env['DATABASE_URL'];
if (!base) {
  throw new Error('web api integration tests need DATABASE_URL_TEST or DATABASE_URL');
}
const adminUrl = new URL(base);
const testDbName = `isp_search_api_${String(process.pid)}`;
const url = new URL(base);
url.pathname = `/${testDbName}`;

const ADMIN_TOKEN = 'test-admin-token-0123456789abcdef';

interface RouteModules {
  post: (request: Request) => Promise<Response>;
  get: (request: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  del: (request: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  action: (request: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
}
let routes: RouteModules;
let pool: pg.Pool;

function submission(line1: string, unit: string | null = null): Request {
  return new Request('http://localhost/api/searches', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      apiVersion: 1,
      address: { line1, unit, city: 'Fixtureville', region: 'ZZ', postalCode: '00000' },
      consentVersion: 'dev-2026-09',
    }),
  });
}

function actionRequest(id: string, body: unknown): [Request, { params: Promise<{ id: string }> }] {
  return [
    new Request(`http://localhost/api/searches/${id}/actions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  ];
}

async function readResource(id: string): Promise<{ status: number; body: unknown }> {
  const response = await routes.get(new Request(`http://localhost/api/searches/${id}`), {
    params: Promise.resolve({ id }),
  });
  return { status: response.status, body: await response.json() };
}

beforeAll(async () => {
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  await admin.query(`create database ${testDbName}`);
  await admin.end();

  process.env['DATABASE_URL'] = url.toString();
  process.env['ADDRESS_HMAC_SECRET'] = randomBytes(32).toString('hex');
  process.env['RAW_ADDRESS_ENCRYPTION_KEY'] = randomBytes(32).toString('hex');
  process.env['JOB_QUEUE_SCHEMA'] = `pgboss_api_${String(process.pid)}`;
  process.env['INTERNAL_ADMIN_TOKEN'] = ADMIN_TOKEN;
  process.env['SEARCH_CREATE_RATE_PER_MINUTE'] = '30';
  process.env['LOG_LEVEL'] = 'silent';

  const { createDatabase, runMigrations, seedReferenceProviders, importRegistry } =
    await import('@isp-search/db');
  const { loadBundledRegistry } = await import('@isp-search/discovery');
  const handle = createDatabase({ connectionString: url.toString(), applicationName: 'api-test' });
  await runMigrations(handle);
  await seedReferenceProviders(handle);
  await importRegistry(handle, loadBundledRegistry('synthetic-dev'), { activate: true });
  await handle.close();

  const create = await import('../app/api/searches/route.js');
  const read = await import('../app/api/searches/[id]/route.js');
  const act = await import('../app/api/searches/[id]/actions/route.js');
  routes = { post: create.POST, get: read.GET, del: read.DELETE, action: act.POST };
  pool = new pg.Pool({ connectionString: url.toString(), max: 2 });
});

afterAll(async () => {
  const { getSearchCore } = await import('../lib/server/search-core.js');
  await getSearchCore().queue.stop({ graceful: false, timeoutMs: 2_000 });
  const { getDatabase } = await import('../lib/server/db.js');
  await getDatabase().close();
  await pool.end();
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`drop database if exists ${testDbName} with (force)`);
  await admin.end();
});

describe('POST /api/searches', () => {
  it('creates a qualifying search for a valid synthetic address', async () => {
    const response = await routes.post(submission('100 Synthetic Way'));
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = (await response.json()) as { id: string; state: string; pollIntervalMs: number };
    expect(body.id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.state).toBe('qualifying');
    expect(body.pollIntervalMs).toBeGreaterThan(0);
  });

  it('rejects malformed JSON, schema violations, and oversized bodies with typed errors', async () => {
    const bad = await routes.post(
      new Request('http://localhost/api/searches', { method: 'POST', body: '{not json' }),
    );
    expect(bad.status).toBe(400);
    const wrong = await routes.post(
      new Request('http://localhost/api/searches', {
        method: 'POST',
        body: JSON.stringify({ apiVersion: 1, address: { line1: '' } }),
      }),
    );
    expect(wrong.status).toBe(400);
    expect(((await wrong.json()) as { code: string }).code).toBe('invalid_request');
    const huge = await routes.post(
      new Request('http://localhost/api/searches', {
        method: 'POST',
        body: JSON.stringify({ pad: 'x'.repeat(5000) }),
      }),
    );
    expect(huge.status).toBe(413);
  });
});

describe('GET /api/searches/:id', () => {
  it('returns a schema-valid progressive resource with truthful provider states', async () => {
    const created = (await (await routes.post(submission('100 Synthetic Way'))).json()) as {
      id: string;
    };
    const { status, body } = await readResource(created.id);
    expect(status).toBe(200);
    const resource = SearchResource.parse(body);
    expect(resource.state).toMatch(/qualifying|partial/);
    expect(resource.market?.supported).toBe(true);
    expect(resource.market?.status).toBe('development_only');
    expect(resource.providers.length).toBe(12);
    expect(resource.completenessStatement).toContain('does not check');
    const linkOnly = resource.providers.find((p) => p.providerId === 'reference-link-only');
    expect(linkOnly?.jobState).toBeNull();
    expect(linkOnly?.availability).toBe('likely_available');
    // No provider can be verified before its job settled.
    for (const provider of resource.providers) {
      expect(['likely_available', 'reported_available', 'unknown']).toContain(
        provider.availability,
      );
    }
  });

  it('unknown, malformed, and truncated ids are indistinguishable not_found', async () => {
    for (const id of [randomBytes(32).toString('base64url'), 'short', '../../etc/passwd']) {
      const { status, body } = await readResource(id);
      expect(status, id).toBe(404);
      expect((body as { code: string }).code).toBe('not_found');
    }
  });

  it('an expired search returns 410 and no display data', async () => {
    const created = (await (await routes.post(submission('100 Synthetic Way'))).json()) as {
      id: string;
    };
    await pool.query(`update searches set expires_at = now() - interval '1 minute' where id = $1`, [
      created.id,
    ]);
    const { status, body } = await readResource(created.id);
    expect(status).toBe(410);
    expect((body as { code: string }).code).toBe('expired');
    expect(JSON.stringify(body)).not.toContain('Synthetic Way');
  });

  it('never echoes the address outside the intentional display field', async () => {
    const response = await routes.post(
      submission(CANARIES.streetLine.replace(/Canary/, 'Synthetic Canary')),
    );
    const created = (await response.json()) as { id: string };
    expect(JSON.stringify(created)).not.toContain('Canary');
    const { body } = await readResource(created.id);
    const resource = SearchResource.parse(body);
    const withoutDisplay = JSON.stringify({ ...resource, displayAddress: null });
    expect(withoutDisplay).not.toContain('Canary');
  });
});

describe('address and provider actions', () => {
  it('walks the ambiguity flow: candidates, selection, qualifying', async () => {
    const created = (await (await routes.post(submission('7 Ambiguous Synthetic'))).json()) as {
      id: string;
      state: string;
      requiredAction: string;
    };
    expect(created.state).toBe('address_action_required');
    expect(created.requiredAction).toBe('select_candidate');
    const { body } = await readResource(created.id);
    const resource = SearchResource.parse(body);
    expect(resource.addressCandidates.length).toBe(2);
    const [request, ctx] = actionRequest(created.id, {
      apiVersion: 1,
      type: 'select_candidate',
      candidateId: resource.addressCandidates[0]?.id,
      epoch: resource.actionEpoch,
    });
    const acted = await routes.action(request, ctx);
    expect(acted.status).toBe(200);
    expect(((await acted.json()) as { state: string }).state).toBe('qualifying');
  });

  it('walks the missing-unit flow and rejects a stale epoch afterwards', async () => {
    const created = (await (await routes.post(submission('200 Mdu Synthetic Ave'))).json()) as {
      id: string;
      requiredAction: string;
    };
    expect(created.requiredAction).toBe('provide_unit');
    const first = await routes.action(
      ...actionRequest(created.id, {
        apiVersion: 1,
        type: 'provide_unit',
        unit: 'Unit 2',
        epoch: 0,
      }),
    );
    expect(first.status).toBe(200);
    const replay = await routes.action(
      ...actionRequest(created.id, {
        apiVersion: 1,
        type: 'provide_unit',
        unit: 'Unit 2',
        epoch: 0,
      }),
    );
    expect(replay.status).toBe(409);
  });

  it('rejects a provider choice when that provider is not waiting', async () => {
    const created = (await (await routes.post(submission('100 Synthetic Way'))).json()) as {
      id: string;
    };
    const response = await routes.action(
      ...actionRequest(created.id, {
        apiVersion: 1,
        type: 'provider_choice',
        providerId: 'reference-available',
        choice: 'Unit 1',
      }),
    );
    expect(response.status).toBe(409);
  });
});

describe('DELETE /api/searches/:id (internal)', () => {
  it('is invisible without the token and deletes with it', async () => {
    const created = (await (await routes.post(submission('100 Synthetic Way'))).json()) as {
      id: string;
    };
    const anonymous = await routes.del(
      new Request(`http://localhost/api/searches/${created.id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(anonymous.status).toBe(404);
    const authorized = await routes.del(
      new Request(`http://localhost/api/searches/${created.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(authorized.status).toBe(200);
    expect((await readResource(created.id)).status).toBe(404);
  });
});

describe('rate limiting', () => {
  it('throttles bursts on the create endpoint', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      const response = await routes.post(submission('100 Synthetic Way'));
      statuses.push(response.status);
    }
    expect(statuses).toContain(429);
  });
});

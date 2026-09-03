import { randomBytes } from 'node:crypto';

import { createSyntheticResolver, type ResolveInput } from '@isp-search/resolver';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { applyAddressAction, SearchActionError } from './address-actions.js';
import { createDatabase, type DatabaseHandle } from './client.js';
import { runMigrations } from './migrations.js';
import { deleteRawAddress } from './retention.js';
import { createSearchSession, getSearch, type SessionPolicy } from './sessions.js';

/**
 * Address-action workflow proofs (PLA-364): unit supply, candidate selection, correction,
 * stale/repeated submission rejection, and expiry behavior — end to end against the real
 * synthetic resolver and the encrypted material.
 */
const base = process.env['DATABASE_URL_TEST'] ?? process.env['DATABASE_URL'];
if (!base) {
  throw new Error('db integration tests need DATABASE_URL_TEST or DATABASE_URL');
}
const adminUrl = new URL(base);
const testDbName = `isp_search_actions_${String(process.pid)}`;
let handle: DatabaseHandle;

const policy: SessionPolicy = {
  hmacKey: { version: 1, secret: randomBytes(32).toString('hex') },
  rawAddressKey: { version: 1, secretHex: randomBytes(32).toString('hex') },
  rawAddressTtlMinutes: 30,
  searchTtlMinutes: 60,
  deadlineSeconds: 40,
  consentVersion: 'test-1',
};

const NOW = new Date('2026-09-03T12:00:00.000Z');
const resolver = createSyntheticResolver();
const context = { now: () => NOW };

function deps(now: Date = NOW) {
  return {
    policy,
    now,
    resolve: (input: ResolveInput) => resolver.resolve(input, context),
  };
}

async function startSearch(line1: string, unit: string | null = null): Promise<string> {
  const resolved = await resolver.resolve(
    { line1, unit, city: 'Fixtureville', region: 'ZZ', postalCode: '00000' },
    context,
  );
  const created = await createSearchSession(handle.db, { resolved, policy, now: NOW });
  return created.searchId;
}

beforeAll(async () => {
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  await admin.query(`create database ${testDbName}`);
  await admin.end();
  const url = new URL(base);
  url.pathname = `/${testDbName}`;
  handle = createDatabase({ connectionString: url.toString(), applicationName: 'isp-search-test' });
  await runMigrations(handle);
});

afterAll(async () => {
  await handle.close();
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`drop database if exists ${testDbName} with (force)`);
  await admin.end();
});

describe('provide_unit', () => {
  it('resumes an MDU search once the unit arrives and changes the cache identity', async () => {
    const searchId = await startSearch('200 Mdu Synthetic Ave');
    const before = await getSearch(handle.db, searchId);
    expect(before?.state).toBe('address_action_required');
    expect(before?.requiredAction).toBe('provide_unit');
    expect(before?.unitOptions).toContain('Unit 2');
    const result = await applyAddressAction(
      handle,
      searchId,
      { type: 'provide_unit', unit: 'Unit 2', epoch: 0 },
      deps(),
    );
    expect(result).toEqual({ state: 'resolving_address', requiredAction: null, actionEpoch: 1 });
    const after = await getSearch(handle.db, searchId);
    expect(after?.displayAddress).toContain('Unit 2');
    expect(after?.addressIdentity).not.toBe(before?.addressIdentity);
  });

  it('an invalid unit proceeds as unconfirmed rather than blocking the user', async () => {
    const searchId = await startSearch('200 Mdu Synthetic Ave');
    const result = await applyAddressAction(
      handle,
      searchId,
      { type: 'provide_unit', unit: 'Unit 99', epoch: 0 },
      deps(),
    );
    expect(result.state).toBe('resolving_address');
    const after = await getSearch(handle.db, searchId);
    expect(after?.validationState).toBe('validated_unit_unconfirmed');
    expect(after?.displayAddress).toContain('Unit 99');
  });
});

describe('select_candidate', () => {
  it('resolves an ambiguous search after an explicit selection', async () => {
    const searchId = await startSearch('7 Ambiguous Synthetic');
    const before = await getSearch(handle.db, searchId);
    expect(before?.requiredAction).toBe('select_candidate');
    const candidateId = before?.addressCandidates?.[0]?.id;
    if (!candidateId) throw new Error('no candidates stored');
    const result = await applyAddressAction(
      handle,
      searchId,
      { type: 'select_candidate', candidateId, epoch: 0 },
      deps(),
    );
    expect(result.state).toBe('resolving_address');
    const after = await getSearch(handle.db, searchId);
    expect(after?.displayAddress).toContain('Way');
  });

  it('rejects an unknown candidate id', async () => {
    const searchId = await startSearch('7 Ambiguous Synthetic');
    await expect(
      applyAddressAction(
        handle,
        searchId,
        { type: 'select_candidate', candidateId: 'nope', epoch: 0 },
        deps(),
      ),
    ).rejects.toMatchObject({ code: 'invalid_action' });
  });
});

describe('correct_input', () => {
  it('lets the user replace an invalid address and continue', async () => {
    const searchId = await startSearch('1 Invalid Synthetic');
    const before = await getSearch(handle.db, searchId);
    expect(before?.requiredAction).toBe('correct_input');
    const result = await applyAddressAction(
      handle,
      searchId,
      {
        type: 'correct_input',
        line1: '100 Synthetic Way',
        unit: null,
        city: 'Fixtureville',
        region: 'ZZ',
        postalCode: '00000',
        epoch: 0,
      },
      deps(),
    );
    expect(result.state).toBe('resolving_address');
  });
});

describe('guards', () => {
  it('rejects stale and repeated submissions deterministically', async () => {
    const searchId = await startSearch('200 Mdu Synthetic Ave');
    await applyAddressAction(
      handle,
      searchId,
      { type: 'provide_unit', unit: 'Unit 1', epoch: 0 },
      deps(),
    );
    // Repeat of the same (now stale) submission: the state moved on.
    await expect(
      applyAddressAction(
        handle,
        searchId,
        { type: 'provide_unit', unit: 'Unit 1', epoch: 0 },
        deps(),
      ),
    ).rejects.toMatchObject({ code: 'action_not_allowed' });
  });

  it('rejects a submission citing the wrong epoch while the action is still open', async () => {
    const searchId = await startSearch('7 Ambiguous Synthetic');
    await expect(
      applyAddressAction(
        handle,
        searchId,
        { type: 'select_candidate', candidateId: 'way', epoch: 7 },
        deps(),
      ),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('rejects the wrong action type for the pending state', async () => {
    const searchId = await startSearch('7 Ambiguous Synthetic');
    await expect(
      applyAddressAction(
        handle,
        searchId,
        { type: 'provide_unit', unit: 'Unit 1', epoch: 0 },
        deps(),
      ),
    ).rejects.toMatchObject({ code: 'action_not_allowed' });
  });

  it('rejects actions on an expired search and on swept material', async () => {
    const searchId = await startSearch('200 Mdu Synthetic Ave');
    const afterExpiry = new Date(NOW.getTime() + 2 * 60 * 60_000);
    await expect(
      applyAddressAction(
        handle,
        searchId,
        { type: 'provide_unit', unit: 'Unit 1', epoch: 0 },
        deps(afterExpiry),
      ),
    ).rejects.toMatchObject({ code: 'expired' });
    // Material swept early (retention) while the search is still current: also expired.
    const second = await startSearch('200 Mdu Synthetic Ave');
    await deleteRawAddress(handle.db, second, {
      trigger: 'manual',
      sweepRunId: 'sweep_actions_test',
      now: NOW,
    });
    await expect(
      applyAddressAction(
        handle,
        second,
        { type: 'provide_unit', unit: 'Unit 1', epoch: 0 },
        deps(),
      ),
    ).rejects.toMatchObject({ code: 'expired' });
  });

  it('unknown search ids are not found', async () => {
    await expect(
      applyAddressAction(
        handle,
        randomBytes(32).toString('base64url'),
        { type: 'provide_unit', unit: 'Unit 1', epoch: 0 },
        deps(),
      ),
    ).rejects.toBeInstanceOf(SearchActionError);
  });
});

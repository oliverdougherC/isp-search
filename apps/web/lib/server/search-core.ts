import {
  loadActiveRegistry,
  sessionPolicyFromEnv,
  type OrchestrationDeps,
  type SessionPolicy,
} from '@isp-search/db';
import { createJobQueue, type JobQueue } from '@isp-search/db/queue';
import { createRegistryCandidateDiscovery } from '@isp-search/discovery';
import { referenceAdapterSet } from '@isp-search/providers';
import {
  createSmartyResolver,
  createSyntheticResolver,
  type AddressResolver,
} from '@isp-search/resolver';

import { getDatabase } from './db';
import { getWebEnv } from './env';
import { getLogger } from './logger';

/**
 * Server-side search-core wiring (PLA-368). One queue, one resolver, one orchestration
 * dependency set per process; the queue is started lazily on the first search submission.
 */

interface SearchCore {
  readonly queue: JobQueue;
  readonly resolver: AddressResolver;
  readonly policy: SessionPolicy;
  readonly orchestration: OrchestrationDeps;
  readonly enabledProviderIds: ReadonlySet<string> | '*';
}

const globalForCore = globalThis as unknown as {
  __ispSearchCore?: SearchCore;
  __ispSearchQueueStarted?: Promise<void>;
};

export function getSearchCore(): SearchCore {
  if (globalForCore.__ispSearchCore) return globalForCore.__ispSearchCore;
  const env = getWebEnv();
  const handle = getDatabase();
  const queue = createJobQueue({
    connectionString: env.DATABASE_URL,
    schema: env.JOB_QUEUE_SCHEMA,
    logger: getLogger(),
  });
  const adapters = referenceAdapterSet();
  const adapterVersionByProvider = new Map(
    adapters.map((adapter) => [adapter.providerId, adapter.version]),
  );
  const enabledProviderIds: ReadonlySet<string> | '*' =
    env.ENABLED_PROVIDER_IDS.trim() === '*'
      ? '*'
      : new Set(
          env.ENABLED_PROVIDER_IDS.split(',')
            .map((id) => id.trim())
            .filter((id) => id.length > 0),
        );
  const policy = sessionPolicyFromEnv(env);
  const resolver =
    env.ADDRESS_RESOLVER === 'smarty'
      ? createSmartyResolver({
          authId: env.SMARTY_AUTH_ID,
          authToken: env.SMARTY_AUTH_TOKEN,
          enabled: env.SMARTY_ENABLED,
        })
      : createSyntheticResolver();
  const core: SearchCore = {
    queue,
    resolver,
    policy,
    enabledProviderIds,
    orchestration: {
      queue,
      discovery: createRegistryCandidateDiscovery({
        loadRegistry: () => loadActiveRegistry(handle),
      }),
      adapterVersionFor: (providerId) => adapterVersionByProvider.get(providerId) ?? null,
      isProviderEnabled: (providerId) =>
        enabledProviderIds === '*'
          ? adapterVersionByProvider.has(providerId)
          : enabledProviderIds.has(providerId),
      policy,
      now: () => new Date(),
    },
  };
  globalForCore.__ispSearchCore = core;
  return core;
}

/** Starts pg-boss once per process (idempotent across hot reloads and concurrent requests). */
export async function ensureQueueStarted(): Promise<void> {
  const core = getSearchCore();
  globalForCore.__ispSearchQueueStarted ??= core.queue.start();
  await globalForCore.__ispSearchQueueStarted;
}

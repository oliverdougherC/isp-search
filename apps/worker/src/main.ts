import { loadWorkerEnv } from '@isp-search/config/server';
import {
  checkDatabaseReadiness,
  createDatabase,
  enforceSearchDeadlines,
  loadActiveRegistry,
  sessionPolicyFromEnv,
  sweepRetention,
  type OrchestrationDeps,
} from '@isp-search/db';
import { createJobQueue, QUEUES, type QualificationJobData } from '@isp-search/db/queue';
import { createRegistryCandidateDiscovery } from '@isp-search/discovery';
import { createLogger, toLoggableError } from '@isp-search/observability';
import { createAdapterRegistry, referenceAdapterSetForEnvironment } from '@isp-search/providers';

import { createHealthServer } from './http/health-server.js';
import { createQualificationProcessor } from './orchestration/processor.js';

/**
 * Worker entrypoint.
 *
 *   node dist/main.js start   — run the job worker with an HTTP health surface
 *   node dist/main.js health  — one-shot readiness probe; exit 0 when ready, 1 otherwise
 */
async function main(argv: readonly string[]): Promise<number> {
  const command = argv[0] ?? 'start';
  const env = loadWorkerEnv();
  const logger = createLogger({
    name: 'worker',
    level: env.LOG_LEVEL,
    base: { app_env: env.NODE_ENV },
  });
  const handle = createDatabase({
    connectionString: env.DATABASE_URL,
    applicationName: 'isp-search-worker',
  });

  if (command === 'health') {
    try {
      const readiness = await checkDatabaseReadiness(handle);
      logger.info(readiness, 'worker health');
      return readiness.status === 'ready' ? 0 : 1;
    } finally {
      await handle.close();
    }
  }

  if (command !== 'start') {
    logger.error({ command }, 'unknown command; expected `start` or `health`');
    await handle.close();
    return 2;
  }

  const startedAt = Date.now();
  let shuttingDown = false;
  const queue = createJobQueue({
    connectionString: env.DATABASE_URL,
    schema: env.JOB_QUEUE_SCHEMA,
    logger,
  });
  await queue.start();

  // M2 orchestration (PLA-367): deterministic reference adapters behind the gated registry,
  // registry-based candidate discovery, per-provider concurrency, typed settle decisions.
  const adapters = referenceAdapterSetForEnvironment({
    nodeEnv: env.NODE_ENV,
    allowReferenceAdapters: env.ALLOW_REFERENCE_ADAPTERS,
  });
  if (adapters.length === 0) {
    logger.warn('no adapters enabled for this environment; providers are link-only');
  }
  const enabledProviderIds =
    env.ENABLED_PROVIDER_IDS.trim() === '*'
      ? new Set(adapters.map((adapter) => adapter.providerId))
      : new Set(
          env.ENABLED_PROVIDER_IDS.split(',')
            .map((id) => id.trim())
            .filter((id) => id.length > 0),
        );
  const registry = createAdapterRegistry(adapters, { enabledProviderIds });
  const adapterVersionByProvider = new Map(
    adapters.map((adapter) => [adapter.providerId, adapter.version]),
  );
  const orchestration: OrchestrationDeps = {
    queue,
    discovery: createRegistryCandidateDiscovery({
      loadRegistry: () => loadActiveRegistry(handle),
    }),
    adapterVersionFor: (providerId) => adapterVersionByProvider.get(providerId) ?? null,
    isProviderEnabled: (providerId) => enabledProviderIds.has(providerId),
    policy: sessionPolicyFromEnv(env),
    now: () => new Date(),
  };
  const processQualification = createQualificationProcessor({
    handle,
    registry,
    orchestration,
    logger,
    providerConcurrency: env.PROVIDER_CONCURRENCY,
  });
  await queue.boss.work<QualificationJobData>(
    QUEUES.qualification,
    { batchSize: 1, localConcurrency: env.WORKER_CONCURRENCY, pollingIntervalSeconds: 1 },
    async (jobs) => {
      for (const job of jobs) {
        await processQualification(job.data);
      }
    },
  );

  // Global-deadline enforcement: idempotent, cheap, and safe to run often.
  const deadlineTimer = setInterval(() => {
    void enforceSearchDeadlines(handle, new Date()).then(
      (summary) => {
        if (summary.expiredJobs > 0 || summary.completedSearches > 0) {
          logger.info(summary, 'deadline enforcement');
        }
      },
      (error: unknown) => {
        logger.error({ err: toLoggableError(error) }, 'deadline enforcement failed');
      },
    );
  }, 5_000);
  deadlineTimer.unref();

  // Retention sweep (PLA-362, ADR-007): scheduled every 5 minutes on the singleton queue.
  // The summary contains counts and typed codes only — safe to log.
  await queue.boss.work(QUEUES.retention, { batchSize: 1 }, async () => {
    const summary = await sweepRetention(handle.db, new Date());
    if (summary.failures.length > 0) {
      logger.error({ ...summary }, 'retention sweep completed with failures');
    } else {
      logger.info({ ...summary }, 'retention sweep complete');
    }
  });
  await queue.boss.schedule(QUEUES.retention, '*/5 * * * *');

  const server = createHealthServer({
    port: env.WORKER_HEALTH_PORT,
    logger,
    liveness: () => ({
      status: shuttingDown ? 'error' : 'ok',
      service: 'worker',
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      shuttingDown,
    }),
    readiness: async () => {
      const database = await checkDatabaseReadiness(handle);
      const queueState = queue.isStarted ? 'ok' : 'error';
      const ready = !shuttingDown && database.status === 'ready' && queueState === 'ok';
      return { status: ready ? 'ready' : 'not_ready', checks: { database, queue: queueState } };
    },
  });
  logger.info(
    { healthPort: env.WORKER_HEALTH_PORT, concurrency: env.WORKER_CONCURRENCY },
    'worker started',
  );

  return await new Promise<number>((resolve) => {
    const shutdown = (signal: string): void => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info({ signal, graceMs: env.SHUTDOWN_GRACE_MS }, 'shutdown requested');
      const force = setTimeout(() => {
        logger.error('shutdown grace period elapsed; forcing exit');
        resolve(1);
      }, env.SHUTDOWN_GRACE_MS);
      force.unref();
      void (async () => {
        try {
          clearInterval(deadlineTimer);
          await new Promise<void>((done) => {
            server.close(() => {
              done();
            });
          });
          await queue.stop({
            graceful: true,
            timeoutMs: Math.max(1_000, env.SHUTDOWN_GRACE_MS - 2_000),
          });
          await handle.close();
          logger.info('shutdown complete');
          resolve(0);
        } catch (error) {
          logger.error({ err: toLoggableError(error) }, 'shutdown failed');
          resolve(1);
        } finally {
          clearTimeout(force);
        }
      })();
    };
    process.once('SIGTERM', () => {
      shutdown('SIGTERM');
    });
    process.once('SIGINT', () => {
      shutdown('SIGINT');
    });
  });
}

process.exitCode = await main(process.argv.slice(2));

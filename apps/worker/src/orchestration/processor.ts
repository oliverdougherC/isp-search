import {
  claimQualificationJob,
  openAddressMaterial,
  settleQualificationJob,
  type AdapterRunResult,
  type DatabaseHandle,
  type OrchestrationDeps,
} from '@isp-search/db';
import type { QualificationJobData } from '@isp-search/db/queue';
import type { Logger } from '@isp-search/observability';
import { QualificationRequest, type AdapterRegistry } from '@isp-search/providers';

/**
 * Worker-side job processing (PLA-367): claim → adapter → settle. Every branch settles or
 * discards deterministically; an adapter throwing is an `invalid_response`, never a crash of
 * the batch, so one provider cannot take down another's work.
 */

class Semaphore {
  #available: number;
  readonly #waiters: (() => void)[] = [];
  constructor(limit: number) {
    this.#available = limit;
  }
  async acquire(): Promise<() => void> {
    if (this.#available > 0) {
      this.#available -= 1;
    } else {
      await new Promise<void>((resolve) => this.#waiters.push(resolve));
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.#waiters.shift();
      if (next) next();
      else this.#available += 1;
    };
  }
}

export interface ProcessorOptions {
  readonly handle: DatabaseHandle;
  readonly registry: AdapterRegistry;
  readonly orchestration: OrchestrationDeps;
  readonly logger: Logger;
  /** Per-provider concurrency ceiling inside this worker. */
  readonly providerConcurrency: number;
}

export function createQualificationProcessor(
  options: ProcessorOptions,
): (data: QualificationJobData) => Promise<void> {
  const semaphores = new Map<string, Semaphore>();
  const semaphoreFor = (providerId: string): Semaphore => {
    let semaphore = semaphores.get(providerId);
    if (!semaphore) {
      semaphore = new Semaphore(options.providerConcurrency);
      semaphores.set(providerId, semaphore);
    }
    return semaphore;
  };

  return async (data: QualificationJobData): Promise<void> => {
    const { handle, registry, orchestration, logger } = options;
    const now = orchestration.now();
    const claim = await claimQualificationJob(handle, data, now);
    if (claim.action === 'discard') {
      logger.info(
        { searchId: data.searchId, providerId: data.providerId, reason: claim.reason },
        'qualification delivery discarded',
      );
      return;
    }

    const startedAt = orchestration.now();
    let result: AdapterRunResult;
    const registration = registry.get(data.providerId);
    if (!registration?.enabled) {
      result = {
        outcome: 'unknown',
        evidence: null,
        diagnostics: { code: 'adapter_disabled' },
      };
    } else {
      const materialQuery = await handle.pool.query(
        'select ciphertext, key_version from search_address_material where search_id = $1',
        [data.searchId],
      );
      const material = materialQuery.rows[0] as
        { ciphertext: Buffer; key_version: number } | undefined;
      if (!material) {
        result = {
          outcome: 'unknown',
          evidence: null,
          diagnostics: { code: 'raw_address_unavailable' },
        };
      } else {
        const opened = openAddressMaterial(
          material.ciphertext,
          material.key_version,
          orchestration.policy.rawAddressKey,
        );
        const request = QualificationRequest.parse({
          searchId: data.searchId,
          providerId: data.providerId,
          correlationId: data.correlationId,
          address: opened.resolved.address,
          deadlineAt: data.deadlineAt,
          attempt: claim.attempt,
          ...(claim.actionResponse !== null ? { actionResponse: claim.actionResponse } : {}),
        });
        const release = await semaphoreFor(data.providerId).acquire();
        try {
          const qualification = await registration.adapter.qualify(request, {
            now: orchestration.now,
          });
          result = {
            outcome: qualification.outcome,
            evidence: qualification.evidence,
            ...(qualification.offers ? { offers: qualification.offers } : {}),
            ...(qualification.actionOptions ? { actionOptions: qualification.actionOptions } : {}),
            diagnostics: qualification.diagnostics,
          };
        } catch {
          // Adapter faults are typed data, never crashes; details stay out of logs by policy.
          result = {
            outcome: 'invalid_response',
            evidence: null,
            diagnostics: { code: 'adapter_threw' },
          };
        } finally {
          release();
        }
      }
    }

    const decision = await settleQualificationJob(
      handle,
      {
        jobId: claim.jobId,
        data,
        attempt: claim.attempt,
        result,
        startedAt,
        finishedAt: orchestration.now(),
      },
      orchestration,
    );
    logger.info(
      {
        searchId: data.searchId,
        providerId: data.providerId,
        adapterVersion: data.adapterVersion,
        attempt: claim.attempt,
        outcome: result.outcome,
        decision: decision.kind,
      },
      'qualification processed',
    );
  };
}

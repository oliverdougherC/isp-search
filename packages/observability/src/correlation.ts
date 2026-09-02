import { randomUUID } from 'node:crypto';

/**
 * Opaque correlation identifiers. They carry no information about the request, the address,
 * or the user; they exist only to join log lines and job records.
 */
export type CorrelationId = string & { readonly __brand: 'CorrelationId' };

const CORRELATION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function newCorrelationId(): CorrelationId {
  return randomUUID() as CorrelationId;
}

export function isCorrelationId(value: unknown): value is CorrelationId {
  return typeof value === 'string' && CORRELATION_PATTERN.test(value);
}

/**
 * Accept an inbound correlation id only if it is well-formed; otherwise mint a new one.
 * Free-form inbound headers are never propagated, so a caller cannot smuggle text into logs.
 */
export function acceptCorrelationId(inbound: string | null | undefined): CorrelationId {
  return isCorrelationId(inbound) ? inbound : newCorrelationId();
}

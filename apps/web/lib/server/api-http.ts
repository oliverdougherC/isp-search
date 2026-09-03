import { publicApiError, type PublicErrorCode } from '@isp-search/domain';
import { NextResponse } from 'next/server';

/**
 * HTTP plumbing for the search API (PLA-368): typed errors, no-store caching, an in-memory
 * per-IP token bucket (the local/product-foundation baseline; edge rate limiting is an M5
 * deployment concern), and a body-size gate.
 */

const STATUS_FOR_CODE: Readonly<Record<PublicErrorCode, number>> = {
  invalid_request: 400,
  not_found: 404,
  expired: 410,
  rate_limited: 429,
  payload_too_large: 413,
  action_not_allowed: 409,
  conflict: 409,
  unsupported_market: 200, // never an error status; carried in the resource itself
  internal: 500,
};

export function errorResponse(code: PublicErrorCode): NextResponse {
  return NextResponse.json(publicApiError(code), {
    status: STATUS_FOR_CODE[code],
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function jsonResponse(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export const MAX_BODY_BYTES = 4096;

/** Reads and parses a small JSON body; `null` means the caller must 400/413. */
export async function readJsonBody(
  request: Request,
): Promise<{ kind: 'ok'; body: unknown } | { kind: 'too_large' } | { kind: 'invalid' }> {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null && Number(contentLength) > MAX_BODY_BYTES) {
    return { kind: 'too_large' };
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { kind: 'invalid' };
  }
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) return { kind: 'too_large' };
  try {
    return { kind: 'ok', body: JSON.parse(text) as unknown };
  } catch {
    return { kind: 'invalid' };
  }
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 10_000;

/** Token bucket per key; refills continuously to `perMinute`. Process-local by design. */
export function allowRequest(key: string, perMinute: number, now = Date.now()): boolean {
  if (buckets.size > MAX_TRACKED_KEYS) buckets.clear();
  const bucket = buckets.get(key) ?? { tokens: perMinute, lastRefill: now };
  const elapsedMs = now - bucket.lastRefill;
  bucket.tokens = Math.min(perMinute, bucket.tokens + (elapsedMs / 60_000) * perMinute);
  bucket.lastRefill = now;
  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ?? 'local';
}

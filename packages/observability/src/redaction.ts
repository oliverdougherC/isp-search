/**
 * Redaction helpers. These are deliberately conservative: when in doubt, redact.
 *
 * Two layers:
 *  1. Key-based: any object key that looks like it carries an address, unit, cookie, token,
 *     session, secret, or raw provider payload is replaced wholesale.
 *  2. Value-based: strings that look like a street address, a bearer token, a JWT, a cookie
 *     header, or a URL query string are rewritten.
 */

export const REDACTED = '[REDACTED]';

/**
 * Keys are split into words (camelCase, snake_case, kebab-case) and every word is checked
 * against this list, so `adapter` is safe while `apt`, `rawPayload`, and `set-cookie` are not.
 */
const SENSITIVE_KEY_WORDS: ReadonlySet<string> = new Set([
  'address',
  'addr',
  'street',
  'line1',
  'line2',
  'unit',
  'apt',
  'apartment',
  'suite',
  'subpremise',
  'premise',
  'zip',
  'zipcode',
  'postal',
  'postalcode',
  'cookie',
  'cookies',
  'setcookie',
  'token',
  'tokens',
  'secret',
  'secrets',
  'password',
  'passwd',
  'pwd',
  'authorization',
  'auth',
  'session',
  'sessionid',
  'bearer',
  'apikey',
  'hmac',
  'raw',
  'payload',
  'body',
  'har',
  'screenshot',
  'screenshots',
  'lat',
  'latitude',
  'lng',
  'lon',
  'longitude',
  'coordinate',
  'coordinates',
  'email',
  'phone',
  'ssn',
  'query',
  'querystring',
]);

function keyWords(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}

const STREET_ADDRESS_PATTERN =
  /\b\d{1,6}[A-Z]?\s+(?:[NSEW]\.?\s+|(?:NORTH|SOUTH|EAST|WEST)\s+)?(?:[A-Z0-9'.-]+\s+){1,5}(?:STREET|ST|AVENUE|AVE|ROAD|RD|BOULEVARD|BLVD|LANE|LN|DRIVE|DR|COURT|CT|WAY|PLACE|PL|TERRACE|TER|CIRCLE|CIR|PARKWAY|PKWY|HIGHWAY|HWY|TRAIL|TRL|LOOP|SQUARE|SQ|ALLEY|ALY|ROUTE|RTE)\b\.?(?:\s*(?:,?\s*(?:APT|APARTMENT|UNIT|STE|SUITE|#|FL|FLOOR|BLDG|BUILDING)\s*[A-Z0-9-]+))?(?:,?\s*[A-Z][A-Z .'-]*,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)?/gi;

const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/g;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g;
const COOKIE_HEADER_PATTERN = /\b(?:set-cookie|cookie)\s*[:=]\s*[^\n;]+(?:;[^\n]*)?/gi;
const URL_QUERY_PATTERN = /(https?:\/\/[^\s?#"']+)\?[^\s"']*/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const US_PHONE_PATTERN = /(?<![\w])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const CANARY_PATTERN = /\bCANARY[-_][A-Za-z0-9_-]{4,}/g;

export function isSensitiveKey(key: string): boolean {
  const words = keyWords(key);
  if (words.some((word) => SENSITIVE_KEY_WORDS.has(word))) return true;
  // Joined forms such as `setcookie`, `apikey`, `sessionid`, `zipcode`.
  return SENSITIVE_KEY_WORDS.has(words.join(''));
}

/** Redact sensitive fragments inside free text (messages, URLs, stack traces). */
export function redactText(input: string): string {
  return input
    .replace(URL_QUERY_PATTERN, `$1?${REDACTED}`)
    .replace(COOKIE_HEADER_PATTERN, `cookie=${REDACTED}`)
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replace(JWT_PATTERN, REDACTED)
    .replace(STREET_ADDRESS_PATTERN, REDACTED)
    .replace(EMAIL_PATTERN, REDACTED)
    .replace(US_PHONE_PATTERN, REDACTED)
    .replace(CANARY_PATTERN, REDACTED);
}

const MAX_DEPTH = 8;

/**
 * Deep-redact a value. Sensitive keys are replaced wholesale; strings are passed through
 * `redactText`; depth is bounded and cycles are cut so logging can never explode.
 */
export function redactValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > MAX_DEPTH) return '[TRUNCATED]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactText(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactText(value.message),
      ...(value.stack ? { stack: redactText(value.stack) } : {}),
    };
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    if (Array.isArray(value)) {
      return value.map((item) => redactValue(item, depth + 1, seen));
    }
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key] = isSensitiveKey(key) ? REDACTED : redactValue(entry, depth + 1, seen);
    }
    return output;
  }
  return typeof value === 'function' ? '[FUNCTION]' : '[UNSERIALIZABLE]';
}

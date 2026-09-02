import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { SYNTHETIC_STREET_TOKENS } from '@isp-search/domain';

/**
 * Fixture and snapshot scanner. It is intentionally strict: a false positive costs a reviewer a
 * minute; a false negative publishes someone's home address.
 */
export interface Finding {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
  /** Redacted excerpt: never the matched text itself. */
  readonly excerpt: string;
}

interface Rule {
  readonly name: string;
  readonly pattern: RegExp;
  readonly allow?: (match: string, line: string) => boolean;
}

const STREET_SUFFIX =
  'STREET|ST|AVENUE|AVE|ROAD|RD|BOULEVARD|BLVD|LANE|LN|DRIVE|DR|COURT|CT|WAY|PLACE|PL|TERRACE|TER|CIRCLE|CIR|PARKWAY|PKWY|HIGHWAY|HWY|TRAIL|TRL|LOOP|SQUARE|SQ|ALLEY|ALY|ROUTE|RTE';

const RULES: readonly Rule[] = [
  {
    name: 'street-address',
    pattern: new RegExp(
      `\\b\\d{1,6}[A-Z]?\\s+(?:[NSEW]\\.?\\s+)?(?:[A-Z][A-Za-z0-9'.-]*\\s+){1,4}(?:${STREET_SUFFIX})\\b\\.?`,
      'gi',
    ),
    allow: (match) => SYNTHETIC_STREET_TOKENS.some((token) => match.toUpperCase().includes(token)),
  },
  {
    name: 'unit-designator',
    pattern: /\b(?:APT|APARTMENT|UNIT|STE|SUITE|BLDG|FLOOR|FL)\.?\s*#?\s*[0-9]+[A-Z]?\b/gi,
    allow: (_match, line) =>
      SYNTHETIC_STREET_TOKENS.some((token) => line.toUpperCase().includes(token)) ||
      /"actionOptions"|Unit\s[0-9][A-Z]\b/.test(line),
  },
  { name: 'us-zip-plus4-real', pattern: /\b(?!000)\d{5}-\d{4}\b/g },
  {
    name: 'coordinates',
    pattern: /\b-?\d{1,2}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}\b/g,
  },
  {
    name: 'email',
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    allow: (m) => /@example\.(com|org|net|invalid)$/i.test(m),
  },
  {
    name: 'phone',
    pattern: /\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
    allow: (m) => /555[\s.-]?01\d\d/.test(m),
  },
  { name: 'cookie-header', pattern: /\b(?:set-cookie|cookie)\s*[:=]/gi },
  {
    name: 'provider-session-field',
    pattern:
      /\b(?:JSESSIONID|PHPSESSID|ASP\.NET_SessionId|_abck|bm_sz|bm_sv|ak_bmsc|__cf_bm|cf_clearance|_px\w*|incap_ses\w*|visid_incap\w*|sessionid|session_id|sessionToken|csrfToken|xsrf-token)\b/gi,
  },
  { name: 'bearer-token', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/g },
  { name: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g },
  { name: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'private-key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  {
    name: 'generic-secret-assignment',
    pattern:
      /\b(?:api[_-]?key|secret|password|passwd|token)\b\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{12,}/gi,
    allow: (m) =>
      m.includes('CANARY') || /\bsecret["']?\s*[:=]\s*["']?(?:string|z\.|required|\$\{)/i.test(m),
  },
  { name: 'canary', pattern: /\bCANARY[-_][A-Z0-9-_]{4,}/g },
  { name: 'har-file', pattern: /"log"\s*:\s*\{\s*"version"\s*:\s*"1\.[0-9]"/g },
];

const SCANNED_EXTENSIONS = new Set([
  '.json',
  '.html',
  '.htm',
  '.txt',
  '.snap',
  '.csv',
  '.xml',
  '.yaml',
  '.yml',
  '.sql',
  '.md',
]);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.turbo', '.git', 'coverage']);

export function redactExcerpt(line: string, matchStart: number, matchLength: number): string {
  const before = line.slice(Math.max(0, matchStart - 20), matchStart);
  const after = line.slice(matchStart + matchLength, matchStart + matchLength + 20);
  return `${before}[MATCH:${String(matchLength)} chars]${after}`.trim();
}

export function scanText(file: string, text: string, rules: readonly Rule[] = RULES): Finding[] {
  const findings: Finding[] = [];
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    for (const rule of rules) {
      rule.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = rule.pattern.exec(line)) !== null) {
        if (rule.allow?.(match[0], line)) continue;
        findings.push({
          file,
          line: index + 1,
          rule: rule.name,
          excerpt: redactExcerpt(line, match.index, match[0].length),
        });
        if (!rule.pattern.global) break;
      }
    }
  });
  return findings;
}

export function isScannable(path: string): boolean {
  const dot = path.lastIndexOf('.');
  return dot >= 0 && SCANNED_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

/** Collect fixture-like files: anything under a `fixtures`, `__snapshots__`, `seed`, or `drizzle` directory. */
export function collectFixtureFiles(root: string): string[] {
  const results: string[] = [];
  const walk = (dir: string, inFixtureTree: boolean): void => {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      const stats = statSync(full);
      if (stats.isDirectory()) {
        const fixtureDir =
          inFixtureTree ||
          ['fixtures', '__snapshots__', 'seed', 'seeds', 'drizzle'].includes(entry);
        walk(full, fixtureDir);
      } else if (inFixtureTree && isScannable(full)) {
        results.push(full);
      }
    }
  };
  walk(root, false);
  return results;
}

export function scanRepository(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const file of collectFixtureFiles(root)) {
    const text = readFileSync(file, 'utf8');
    findings.push(...scanText(relative(root, file), text));
  }
  return findings;
}

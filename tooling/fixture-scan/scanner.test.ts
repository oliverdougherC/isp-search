import { resolve } from 'node:path';

import { CANARIES } from '@isp-search/observability/test-support';
import { describe, expect, it } from 'vitest';

import { scanRepository, scanText } from './scanner.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

describe('fixture scanner', () => {
  it('rejects street and unit canaries', () => {
    const findings = scanText('f.json', `{"line1":"${CANARIES.streetLine} ${CANARIES.unit}"}`);
    expect(findings.map((f) => f.rule)).toEqual(
      expect.arrayContaining(['street-address', 'unit-designator']),
    );
    expect(scanText('f.json', CANARIES.secret).map((f) => f.rule)).toContain('canary');
  });

  it('rejects cookies, tokens, jwts, emails, phone numbers, and session fields', () => {
    const text = [
      `Set-Cookie: ${CANARIES.cookie}`,
      `Authorization: ${CANARIES.bearer}`,
      CANARIES.jwt,
      CANARIES.email.replace('example.com', 'realdomain.net'),
      '(415) 867-5309',
      '{"_abck":"x","bm_sz":"y","JSESSIONID":"z"}',
      'AKIAABCDEFGHIJKLMNOP',
    ].join('\n');
    const rules = new Set(scanText('f.json', text).map((f) => f.rule));
    for (const expected of [
      'cookie-header',
      'bearer-token',
      'jwt',
      'email',
      'phone',
      'provider-session-field',
      'aws-access-key',
    ]) {
      expect(rules, expected).toContain(expected);
    }
  });

  it('never includes the matched text in the excerpt', () => {
    const findings = scanText('f.json', CANARIES.fullAddress);
    for (const finding of findings) {
      expect(finding.excerpt).not.toContain('Canary Street');
      expect(finding.excerpt).toContain('[MATCH:');
    }
  });

  it('accepts synthetic addresses and example.com emails', () => {
    const findings = scanText(
      'f.json',
      '{"line1":"100 Synthetic Way","unit":"Apt 2","city":"Fixtureville","region":"ZZ","postalCode":"00042","contact":"nobody@example.com","phone":"555-0100"}',
    );
    expect(findings).toEqual([]);
  });

  it('the committed repository fixtures are clean', () => {
    const findings = scanRepository(REPO_ROOT);
    expect(findings).toEqual([]);
  });
});

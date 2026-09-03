# Fixture sanitation policy

Fixtures let deterministic tests exercise provider behaviour without the network, without real
people's addresses, and without provider sessions. A fixture that leaks any of those is a privacy
incident, not a test asset.

## Rules

1. **Synthetic by construction.** Every address in a committed fixture, snapshot, seed, or test
   satisfies `isSyntheticAddress` (`packages/domain/src/synthetic.ts`): the street line contains
   `Synthetic`, `Fixture`, or `Example`; the region is `ZZ`; the postal code starts with `000`.
   Use `syntheticAddress()` rather than typing addresses.
2. **No captured session material.** No cookies, `Set-Cookie` headers, session identifiers,
   CSRF tokens, bot-manager cookies (`_abck`, `bm_sz`, `__cf_bm`, ...), bearer tokens, JWTs, API
   keys, or HAR files, ever.
3. **No personal data.** No real names, emails (only `example.com`), phone numbers (only
   `555-01xx`), or precise coordinates.
4. **Provenance metadata is mandatory.** Every fixture carries `sourceType`, `capturedAt`,
   `adapterVersion`, `parserVersion`, a `sanitation` note describing what was removed, and a shape
   `fingerprint` (`computeFixtureFingerprint`). Fixtures of `sourceType: sanitized_capture` are
   allowed only after the checklist below; today every fixture is `synthetic`.
5. **Shape, not content.** A sanitized capture keeps the structure a parser depends on and
   replaces every value that could identify a person, a session, or a real address.
6. **Scanner is authoritative.** `pnpm scan:fixtures` (also in CI) must pass. It rejects
   real-looking street addresses and units, real ZIP+4 codes, coordinates, emails, phone numbers,
   cookie headers, provider session fields, bearer tokens, JWTs, cloud keys, private keys, generic
   secret assignments, canary markers, and HAR structures under any `fixtures`, `__snapshots__`,
   `seed`, or `drizzle` directory.

## Review checklist for a sanitized capture (future adapters)

- [ ] Captured against a consented corpus address (PLA-349) and replaced with a synthetic one
- [ ] All request/response headers removed; only the body shape retained
- [ ] Every identifier, order number, account reference, and timestamp replaced or coarsened
- [ ] Prices and plan names may remain only if they are public marketing values
- [ ] `sanitation` note explains the source page, the capture date, and what was replaced
- [ ] Fingerprint regenerated (`packages/providers/scripts/refingerprint.mjs`)
- [ ] `pnpm scan:fixtures` and `pnpm scan:secrets` pass
- [ ] A second reviewer confirmed no residual address or session material

## Updating fixtures when upstream changes

When a provider changes its format, add a new fixture with a new `parserVersion` rather than
editing the old one in place, so `upstream_changed` detection and the old parser's tests remain
meaningful until the old parser is retired.

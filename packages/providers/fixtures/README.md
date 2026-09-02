# Provider fixtures

Every file here is **synthetic**. See `docs/security/fixture-sanitation.md` for the rules and
review checklist. Fixtures carry provenance metadata (`sourceType`, `capturedAt`, adapter and
parser versions, a sanitation note) and a shape `fingerprint` computed by
`computeFixtureFingerprint` in `packages/providers/src/fixtures.ts`.

Regenerate fingerprints after editing a body with:

```bash
pnpm --filter @isp-search/providers exec node scripts/refingerprint.mjs
```

The fixture scanner (`pnpm scan:fixtures`) rejects any real-looking address, unit, cookie,
token, email, phone number, or provider session field.

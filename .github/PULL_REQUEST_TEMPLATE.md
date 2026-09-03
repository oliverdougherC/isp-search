## Linear issue

PLA-___ — <link>

## What changed

<!-- One paragraph. What a reviewer needs to know to review, not the diff restated. -->

## Evidence

<!-- Paste exact commands and outcomes. "Not run" is acceptable; "passed" without output is not. -->

```text
pnpm verify             →
pnpm test:integration   →
pnpm scan:fixtures      →
pnpm scan:secrets       →
```

## Migrations and configuration

- [ ] No schema change, or migration files generated with `pnpm db:generate` and reviewed
- [ ] No new configuration, or `.env.example` and `packages/config` updated together

## Privacy and security review

- [ ] No raw address, unit, cookie, token, session, HAR, screenshot, browser profile, or provider
      payload is introduced anywhere (including fixtures, snapshots, and test names)
- [ ] Logging changes keep the redaction canary tests green
- [ ] No new outbound network destination, or it is allowlisted and documented

## External integration impact

<!-- Provider, FCC, vendor, or terms implications. "None" is fine when true. -->

## Documentation and ADRs

- [ ] Docs updated, or not needed
- [ ] ADR added or amended, or no decision changed

## Draft status

- [ ] This PR is a draft until CI is green and the evidence above is complete
- [ ] I have not merged this myself; maintainers merge after review

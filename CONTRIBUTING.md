# Contributing to ISP Search

Thank you for helping build a truthful, privacy-safe internet-provider search. This project is
developed in the open, milestone by milestone, with decisions recorded in Linear and in ADRs.

## Before you start

- Read [`AGENTS.md`](AGENTS.md) (it applies to humans too) and the
  [security and privacy invariants](docs/security/security-privacy-invariants.md).
- Find or file the Linear issue that covers the change. Every PR links to one.
- Check [`docs/adr`](docs/adr/README.md) for decisions that constrain the area you are touching.

## Local setup

Follow the [README quick start](README.md#quick-start) and
[`docs/local-development.md`](docs/local-development.md).

## Workflow

1. Branch from `main` (or from the branch your change depends on, for stacked PRs).
   Use `type/pla-NNN-short-description`, for example `feat/pla-355-queue-proof`.
2. Make focused commits with [Conventional Commits](https://www.conventionalcommits.org/) messages
   (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`, `ci:`).
3. Run the full local gate before pushing:

   ```bash
   pnpm verify            # format:check, lint, typecheck, test, build
   pnpm db:up && pnpm test:integration
   pnpm scan:fixtures && pnpm scan:secrets
   ```

4. Open a **draft pull request** using the template. Fill in the evidence sections honestly;
   "not run" is an acceptable answer, "passed" without output is not.
5. Mark ready for review only when CI is green. Maintainers merge; nothing auto-merges.

## What a PR must contain

- Tests for success and meaningful failure paths.
- Documentation or ADR updates when behaviour, configuration, or a decision changes.
- Migration files generated with `pnpm db:generate` when the schema changes, plus a note on
  rollback.
- A privacy review: confirm no raw address, unit, cookie, token, session, HAR, screenshot, or
  provider payload is introduced anywhere (fixtures included).
- An external-integration impact statement when provider, FCC, or vendor behaviour is involved.

## Fixtures

Fixtures are synthetic by construction. Follow
[`docs/security/fixture-sanitation.md`](docs/security/fixture-sanitation.md) and the
conventions in `packages/domain/src/synthetic.ts`. `pnpm scan:fixtures` must pass.

## Provider integrations

No provider adapter may be enabled without a recorded integration tier in ADR-004 and a
current terms review in `docs/sources/provider-terms-review.md`. Contributions that solve or
bypass CAPTCHA, rotate proxies, spoof fingerprints, defeat rate limits or WAFs, or automate
authenticated accounts will be declined regardless of technical merit.

## Reporting problems

- Bugs and proposals: GitHub issues using the templates.
- Security or privacy issues: **not** public issues. See [`SECURITY.md`](SECURITY.md).

## License

By contributing you agree that your contributions are licensed under the Apache License 2.0.

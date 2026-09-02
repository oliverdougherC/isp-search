# AGENTS.md — working in this repository

This file is for coding agents and humans alike. Read it before changing anything.

## Sources of truth, in order

1. The current repository and its tests.
2. The Linear project [ISP Search](https://linear.app/platinum-labs/project/isp-search-f03fc61c15a2),
   its milestones, issues, and three planning documents.
3. Architecture decision records in `docs/adr`.
4. Current official external documentation (verify versions and terms at execution time).
5. Explicit maintainer decisions.

A stale prompt never overrides a newer repository or Linear decision.

## Hard rules

- **Never** commit a real residential address, unit, provider cookie, session, token, raw HAR,
  screenshot, browser profile, database dump, or unredacted provider response. Fixtures must
  satisfy `docs/security/fixture-sanitation.md`; `pnpm scan:fixtures` enforces it.
- **Never** solve or bypass CAPTCHA, rotate proxies, spoof fingerprints, defeat rate limits or
  WAFs, or automate authenticated customer accounts. If a provider blocks automation, the answer
  is a typed `unknown` outcome and an official link, not a workaround.
- No LLM in the availability, offer, pricing, or truth path. Extraction is deterministic.
- Live provider adapters are gated by ADR-004. The registry rejects live tiers unless explicitly
  allowed, and a provider can always be downgraded to link-only by configuration.
- Keep raw addresses out of logs, errors, metric labels, URLs, and client bundles. The canary
  tests in `packages/observability` and `tooling/` must stay green.
- Playwright may only be imported under `apps/worker`.
- Migrations are explicit (`pnpm db:migrate`). Applications never mutate schema on startup.

## Workflow

- `main` was bootstrapped directly once. After that: feature branches, conventional commits,
  draft pull requests linked to Linear issues. Never auto-merge; never force-push shared branches.
- Before opening a PR run `pnpm verify` (format, lint, typecheck, test, build) and, with
  PostgreSQL up, `pnpm test:integration`.
- Every completed Linear issue gets a comment with branch/PR, exact commands, exact outcomes,
  ADR/doc links, migration or config changes, caveats, and follow-ups.
- Record decisions as ADRs (`docs/adr/ADR-000-template.md`), not as code comments.

## Package boundaries

`domain` imports nothing internal. `providers` never imports `db`. `ui` is browser-safe.
`web` never imports `worker`. Web client code (`_client/` directories, `*.client.tsx`) never
imports server-only packages. ESLint enforces these; `tooling/boundaries` proves it.

## Conventions

- TypeScript strict with `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
  `verbatimModuleSyntax`, and `erasableSyntaxOnly`. No `any`.
- Runtime validation (zod) at every external boundary: environment, fixtures, provider payloads,
  API input.
- Synthetic addresses use the reserved tokens in `packages/domain/src/synthetic.ts`.
- Tests: deterministic suites cannot reach the network (`tooling/vitest/no-network.ts`).

# Local development

## Prerequisites

- Node.js 24.20.0. `pnpm install` downloads it automatically into the workspace (`devEngines` in
  `package.json`); `.node-version` is present for version managers and CI.
- pnpm 11.25.0 (`packageManager` field; Corepack or a global pnpm ≥ 11 switches automatically).
- Docker with Compose v2.

## First run

```bash
pnpm install
pnpm env:init     # .env with a generated ADDRESS_HMAC_SECRET (mode 600); never commit it
pnpm db:up        # PostgreSQL 18 on localhost:55432 (host port chosen to avoid a local Postgres)
pnpm db:migrate   # apply committed SQL migrations
pnpm build
pnpm db:seed      # synthetic reference providers (builds packages/db first if needed)
pnpm dev          # web http://localhost:3000, worker health http://localhost:3100
```

`.env` is loaded by `scripts/with-env.mjs` for `pnpm dev`, `pnpm db:*`, `pnpm worker:health`,
and `pnpm test:integration`. Next.js loads `.env` files from `apps/web` only, so the root `.env`
is injected into the process environment by that script instead. Do not set `NODE_ENV` in `.env`.

## Everyday commands

| Command                                    | Purpose                                                     |
| ------------------------------------------ | ----------------------------------------------------------- |
| `pnpm verify`                              | format check, lint, typecheck, unit tests, build            |
| `pnpm test:integration`                    | migration and pg-boss proof tests against PostgreSQL        |
| `pnpm db:generate`                         | generate a migration after editing `packages/db/src/schema` |
| `pnpm db:check`                            | Drizzle consistency check                                   |
| `pnpm db:status`                           | readiness (connectivity + applied migrations)               |
| `pnpm db:reset`                            | destroy the local database volume, recreate, migrate        |
| `pnpm worker:health`                       | one-shot worker readiness probe                             |
| `pnpm scan:fixtures` / `pnpm scan:secrets` | PII/secret scanners                                         |
| `pnpm clean`                               | remove build output and caches                              |

## Migrations

Schema lives in `packages/db/src/schema`. Generate SQL with `pnpm db:generate`, review the SQL in
`packages/db/drizzle`, commit both the SQL and `meta/`. Apply with `pnpm db:migrate`. Applications
never migrate implicitly; readiness reports `not_ready` with `migrations.status = pending` until
the operator applies them. CI verifies that `db:generate` is a no-op for the committed schema.

## Docker volumes and reset

The database persists in the `postgres-data` named volume. `pnpm db:down` stops the container and
keeps data; `pnpm db:reset` (or `docker compose down -v`) deletes it. Override the host port with
`POSTGRES_PORT=... docker compose up -d` and update `DATABASE_URL` accordingly.

## Ports

| Port  | Service                              |
| ----- | ------------------------------------ |
| 3000  | web (`PORT`)                         |
| 3100  | worker health (`WORKER_HEALTH_PORT`) |
| 55432 | PostgreSQL (host side)               |

## Production images

`apps/web/Dockerfile` builds a Next.js standalone image on `node:24.20.0-alpine` with no browser
dependencies. `apps/worker/Dockerfile` builds on the Playwright base image and is the only image
with browser dependencies. Both build from the repository root.

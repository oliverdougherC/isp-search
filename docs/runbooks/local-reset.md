# Runbook: reset the local environment

Use when migrations are out of sync, the queue schema is confused, or you want a clean slate.

1. Stop running processes (`Ctrl+C` on `pnpm dev`).
2. `pnpm db:reset` — destroys the `postgres-data` volume, recreates PostgreSQL, applies migrations.
3. `pnpm db:seed` — reinserts synthetic reference providers.
4. `pnpm clean && pnpm build` — clears `dist`, `.next`, and Turborepo caches.
5. `pnpm worker:health` — must exit 0.
6. Restart `pnpm dev`.

If `pnpm db:up` reports a healthy container but connections fail with "role does not exist",
another PostgreSQL is listening on the same host port. The compose file uses 55432 to avoid the
default; check `lsof -nP -iTCP:55432 -sTCP:LISTEN`.

import { defineConfig } from 'drizzle-kit';

/**
 * Migration ownership: schema changes are made in `src/schema`, SQL migrations are generated
 * with `pnpm db:generate`, reviewed in the PR, and applied explicitly with `pnpm db:migrate`
 * (locally) or the deployment migration step. Applications never mutate schema implicitly.
 */
const url = process.env['DATABASE_URL'];
if (!url) {
  throw new Error('DATABASE_URL must be set to run drizzle-kit commands (see .env.example).');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});

/**
 * M2 persistence model (PLA-361). Migration ownership stays explicit: edit these files, run
 * `pnpm db:generate`, review the SQL, commit both. Applications never mutate schema on startup.
 */
export * from './enums.js';
export * from './providers.js';
export * from './searches.js';
export * from './offers.js';
export * from './retention.js';

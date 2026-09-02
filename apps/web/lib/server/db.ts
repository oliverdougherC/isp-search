import { createDatabase, type DatabaseHandle } from '@isp-search/db';

import { getWebEnv } from './env';

const globalForDb = globalThis as unknown as { __ispSearchDb?: DatabaseHandle };

/** Process-wide database handle (survives dev hot reloads via globalThis). */
export function getDatabase(): DatabaseHandle {
  globalForDb.__ispSearchDb ??= createDatabase({
    connectionString: getWebEnv().DATABASE_URL,
    applicationName: 'isp-search-web',
  });
  return globalForDb.__ispSearchDb;
}

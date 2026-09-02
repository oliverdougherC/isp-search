import { createLogger, type Logger } from '@isp-search/observability';

import { getWebEnv } from './env';

let cached: Logger | undefined;

export function getLogger(): Logger {
  cached ??= createLogger({ name: 'web', level: getWebEnv().LOG_LEVEL });
  return cached;
}

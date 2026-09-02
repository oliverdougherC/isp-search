import { loadPublicEnv, type PublicEnv } from '@isp-search/config';

/**
 * Browser-safe configuration. Next.js inlines `NEXT_PUBLIC_*` variables at build time, so they
 * must be referenced by literal name here.
 */
export function publicEnv(): PublicEnv {
  return loadPublicEnv({
    NEXT_PUBLIC_APP_ENV: process.env['NEXT_PUBLIC_APP_ENV'],
    NEXT_PUBLIC_APP_NAME: process.env['NEXT_PUBLIC_APP_NAME'],
  });
}

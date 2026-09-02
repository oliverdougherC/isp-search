import { loadWebServerEnv, type WebServerEnv } from '@isp-search/config/server';

let cached: WebServerEnv | undefined;

/** Validated server environment, loaded once per process. Never import from client code. */
export function getWebEnv(): WebServerEnv {
  cached ??= loadWebServerEnv();
  return cached;
}

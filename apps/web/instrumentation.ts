/**
 * Runs once when the Node.js server starts. Validates configuration before any request is
 * served so a misconfigured deployment fails fast with an actionable error.
 */
export async function register(): Promise<void> {
  if (process.env['NEXT_RUNTIME'] === 'nodejs') {
    const { getWebEnv } = await import('./lib/server/env');
    getWebEnv();
  }
}

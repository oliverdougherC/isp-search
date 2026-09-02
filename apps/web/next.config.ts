import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // Server-only native/database packages must not be bundled.
  serverExternalPackages: ['pg', 'pg-boss', 'pino', 'drizzle-orm'],
  // The readiness check reads the committed migration journal at runtime; make sure the
  // standalone output carries it (file tracing cannot see dynamic readFileSync paths).
  outputFileTracingIncludes: { '/api/ready': ['../../packages/db/drizzle/**/*'] },
  headers: () =>
    Promise.resolve([
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=()' },
        ],
      },
    ]),
};

export default nextConfig;

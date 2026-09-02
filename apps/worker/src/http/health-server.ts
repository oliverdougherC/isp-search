import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { Logger } from '@isp-search/observability';

export interface HealthReport {
  readonly status: 'ok' | 'error';
  readonly service: 'worker';
  readonly uptimeSeconds: number;
  readonly shuttingDown: boolean;
}

export interface ReadinessReport {
  readonly status: 'ready' | 'not_ready';
  readonly checks: Readonly<Record<string, unknown>>;
}

export interface HealthServerOptions {
  readonly port: number;
  readonly logger: Logger;
  readonly liveness: () => HealthReport;
  readonly readiness: () => Promise<ReadinessReport>;
}

/**
 * Minimal HTTP surface for orchestration probes. No request data is logged beyond method and
 * path; the worker never receives addresses over HTTP.
 */
export function createHealthServer(options: HealthServerOptions): Server {
  const handler = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const path = (request.url ?? '/').split('?')[0];
    if (request.method !== 'GET') {
      response.writeHead(405, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'method_not_allowed' }));
      return;
    }
    if (path === '/health') {
      const report = options.liveness();
      response.writeHead(report.status === 'ok' ? 200 : 503, {
        'content-type': 'application/json',
      });
      response.end(JSON.stringify(report));
      return;
    }
    if (path === '/ready') {
      const report = await options.readiness();
      response.writeHead(report.status === 'ready' ? 200 : 503, {
        'content-type': 'application/json',
      });
      response.end(JSON.stringify(report));
      return;
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'not_found' }));
  };

  const server = createServer((request, response) => {
    handler(request, response).catch((error: unknown) => {
      options.logger.error({ err: error }, 'health server request failed');
      if (!response.headersSent) {
        response.writeHead(500, { 'content-type': 'application/json' });
      }
      response.end(JSON.stringify({ error: 'internal' }));
    });
  });
  server.listen(options.port, '0.0.0.0');
  return server;
}

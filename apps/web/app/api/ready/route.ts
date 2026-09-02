import { checkDatabaseReadiness } from '@isp-search/db';
import { acceptCorrelationId, toSafeError } from '@isp-search/observability';
import { NextResponse } from 'next/server';

import { getDatabase } from '@/lib/server/db';
import { getLogger } from '@/lib/server/logger';

export const dynamic = 'force-dynamic';

/** Readiness: database reachable and migrations applied. */
export async function GET(request: Request) {
  const correlationId = acceptCorrelationId(request.headers.get('x-correlation-id'));
  try {
    const readiness = await checkDatabaseReadiness(getDatabase());
    return NextResponse.json(
      { status: readiness.status, service: 'web', checks: readiness.checks, correlationId },
      {
        status: readiness.status === 'ready' ? 200 : 503,
        headers: { 'x-correlation-id': correlationId },
      },
    );
  } catch (error) {
    getLogger().error({ err: error, correlationId }, 'readiness check failed');
    return NextResponse.json(toSafeError(error, correlationId), { status: 503 });
  }
}

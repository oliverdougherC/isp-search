import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Liveness: the process is up. Contains no configuration and no secrets. */
export function GET() {
  return NextResponse.json({ status: 'ok', service: 'web', time: new Date().toISOString() });
}

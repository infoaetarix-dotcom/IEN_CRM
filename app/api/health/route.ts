import { NextResponse } from 'next/server';

// Uptime check — public, no auth, no DB access.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}

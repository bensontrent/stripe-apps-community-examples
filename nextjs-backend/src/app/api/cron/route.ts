// GET /api/cron
//
// Example of a route protected by BEARER TOKEN auth.
//
// /api/cron is listed in BEARER_ONLY_ROUTES in src/proxy.ts, so a request
// only reaches this handler after presenting `Authorization: Bearer <key>`
// where <key> matched one of:
//
//   - BEARER_TOKEN_KEYS (comma-separated env var)   → x-auth-type: bearer-token
//   - CRON_SECRET (Vercel cron sends this for you)  → x-auth-type: bearer-token
//   - DEV_API_KEY (only when NODE_ENV=development)  → x-auth-type: dev-api-key
//
// Try it locally:
//   curl http://localhost:3000/api/cron -H "Authorization: Bearer $DEV_API_KEY"

import { NextRequest, NextResponse } from 'next/server';
import { AUTH_HEADERS } from '@/lib/proxy-auth';

export async function GET(req: NextRequest) {
  const authType = req.headers.get(AUTH_HEADERS.authType);

  // Defense in depth: the proxy strips x-auth-type from incoming requests,
  // so this value can only have been set by a successful verification.
  if (authType !== 'bearer-token' && authType !== 'dev-api-key') {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Bearer token required' },
      { status: 401 },
    );
  }

  // Run your scheduled work here (sync data, clean up stale rows, ...).
  return NextResponse.json({
    ok: true,
    authType,
    ranAt: new Date().toISOString(),
    message: 'Cron job executed.',
  });
}

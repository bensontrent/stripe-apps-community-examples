// GET /api/public/download?token=<jwt>&account=<acct_...>
//
// Example of a PUBLIC route with ROUTE-LEVEL authentication.
//
// The proxy (src/proxy.ts) lets everything under /api/public through
// without checking anything — this handler does its own verification using
// the JWT passed in the URL query string. That makes the URL self-contained
// and shareable for its (short) lifetime: it works in a new browser tab, an
// <img src>, or a link handed to another app, none of which can send
// headers or cookies.
//
// Get a token from POST /api/stripe-app/token (a signed Stripe App request).

import { NextRequest, NextResponse } from 'next/server';
import { verifyUrlToken } from '@/lib/url-token';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const account = req.nextUrl.searchParams.get('account');

  if (!token || !account) {
    return NextResponse.json(
      {
        error: 'Bad request',
        message: 'Both `token` and `account` query parameters are required',
      },
      { status: 400 },
    );
  }

  try {
    const payload = await verifyUrlToken(token, req.nextUrl.pathname, account);

    // In a real app this is where you'd stream a PDF, a CSV export, etc.
    return NextResponse.json({
      ok: true,
      accountId: payload.accountId,
      message:
        'URL token verified at the route level. Replace this JSON with your file download.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Access denied',
        message: error instanceof Error ? error.message : 'Invalid token',
      },
      { status: 401 },
    );
  }
}

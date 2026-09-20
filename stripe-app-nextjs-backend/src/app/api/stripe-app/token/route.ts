// POST /api/stripe-app/token
//
// Mints a short-lived JWT that can be passed in a URL query string —
// the bridge between authenticated Stripe App requests and PUBLIC routes
// that verify at the route level (see /api/public/download).
//
// The request itself is protected by STRIPE APP SIGNATURE auth (verified in
// the proxy), so we know which Stripe account is asking. The token we mint
// is bound to that account and to a single path, and expires quickly.
//
// Body (optional): { "path": "/api/public/download" }

import { NextRequest, NextResponse } from 'next/server';
import { AUTH_HEADERS } from '@/lib/proxy-auth';
import {
  signUrlToken,
  URL_TOKEN_ALLOWED_PATHS,
} from '@/lib/url-token';

const TOKEN_TTL = '15m';

export async function POST(req: NextRequest) {
  if (req.headers.get(AUTH_HEADERS.stripeVerified) !== 'true') {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Stripe signature not verified' },
      { status: 401 },
    );
  }

  // Trustworthy: the Stripe signature the proxy verified covers this header.
  const accountId = req.headers.get('stripe-account-id');
  if (!accountId) {
    return NextResponse.json(
      { error: 'Bad request', message: 'Missing stripe-account-id' },
      { status: 400 },
    );
  }

  let path = URL_TOKEN_ALLOWED_PATHS[0];
  try {
    const body = (await req.json()) as { path?: string };
    if (body.path) path = body.path;
  } catch {
    // No body — fall back to the default path.
  }

  // Only mint tokens for paths that verifyUrlToken will accept.
  if (!URL_TOKEN_ALLOWED_PATHS.some((allowed) => path.startsWith(allowed))) {
    return NextResponse.json(
      { error: 'Bad request', message: `Path not allowed: ${path}` },
      { status: 400 },
    );
  }

  const token = await signUrlToken({ accountId, path }, TOKEN_TTL);

  const url = new URL(path, req.nextUrl.origin);
  url.searchParams.set('token', token);
  url.searchParams.set('account', accountId);

  return NextResponse.json({
    token,
    expiresIn: TOKEN_TTL,
    // Ready-to-open link, e.g. for a Stripe App to hand to the browser.
    url: url.toString(),
  });
}

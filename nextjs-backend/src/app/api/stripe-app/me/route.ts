// GET /api/stripe-app/me
//
// Example of a route protected by STRIPE APP SIGNATURE auth.
//
// The proxy (src/proxy.ts) already verified the `stripe-signature` header
// against STRIPE_APP_SECRET before this handler runs, and set
// `x-stripe-verified: true` + `x-auth-type: stripe-signature`. Because the
// signature covers the stripe-user-id / stripe-account-id headers, those
// values are trustworthy here.
//
// Call it from the Stripe App with the signed-fetch client in
// stripe-app/src/api/backend.ts.

import { AUTH_HEADERS } from '@/lib/proxy-auth';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {


  // Defense in depth: confirm the proxy actually verified this request.
  // (The proxy strips these headers from incoming requests, so a client
  // can't set them itself.)
  if (req.headers.get(AUTH_HEADERS.stripeVerified) !== 'true') {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Stripe signature not verified' },
      { status: 401 },
    );
  }

  return NextResponse.json({
    accountId: req.headers.get('stripe-account-id'),
    userId: req.headers.get('stripe-user-id'),
    mode: req.headers.get('stripe-mode'),
    authType: req.headers.get(AUTH_HEADERS.authType),
    message: 'Signed Stripe App request verified by the proxy.',
  });
}

// /api/stripe-app/paywall/trial — STRIPE APP SIGNATURE auth.
//
//   POST    Start the calling Stripe account's free trial and answer with
//           the new PaywallStatus. The app calls this when the user accepts
//           the trial terms. Idempotent: if the trial already exists it is
//           returned untouched — pressing the button again, or a colleague
//           pressing it at the same moment, never restarts the clock.
//
//   DELETE  Forget the trial, so the demo can be run again. Only answers
//           when NODE_ENV=development (`next dev`); anywhere else it is a
//           404, because in production it would be a free-trial vending
//           machine. Delete this handler when you copy the route.
//
// See src/lib/paywall.ts.

import { NextRequest, NextResponse } from 'next/server';
import { resetTrial, startTrial } from '@/lib/paywall';
import { getSignedIdentity } from '@/lib/signed-request';

export async function POST(req: NextRequest) {
  try {
    const identity = getSignedIdentity(req);
    if (identity instanceof NextResponse) return identity;

    return NextResponse.json(await startTrial(identity));
  } catch (error) {
    console.error('Error starting trial:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const identity = getSignedIdentity(req);
    if (identity instanceof NextResponse) return identity;

    return NextResponse.json(await resetTrial(identity));
  } catch (error) {
    console.error('Error resetting trial:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

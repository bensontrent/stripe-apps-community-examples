// /api/stripe-app/paywall/usage — STRIPE APP SIGNATURE auth.
//
//   POST  Use the paid feature once. This is the example of a GATED ROUTE —
//         the pattern to copy into every route of yours that does something
//         worth paying for:
//
//           1. recordFeatureUse() checks access and, during a trial, counts
//              the use against the allowance (atomically).
//           2. Not allowed → 402 Payment Required, with the PaywallStatus in
//              the body so the app can show the right paywall view.
//           3. Allowed → do the work, answer 200.
//
//         200  { status: PaywallStatus, result: … }
//         402  { error, message, status: PaywallStatus }
//
// The "work" here is a stand-in (it makes up a widget id). In your app it
// is the shipment label, the report, the export — and it goes after the
// check, never before.
//
// Why check here when the app already hides the feature: the app's UI is a
// courtesy, not a lock. Anyone can replay a signed request from the browser's
// network tab, so the route that does the work is the only place a paywall
// actually holds.
//
// See src/lib/paywall.ts.

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { recordFeatureUse } from '@/lib/paywall';
import { getSignedIdentity } from '@/lib/signed-request';
import { REASON_MESSAGES, type PaywallDeniedBody } from '@/types/paywall';

export async function POST(req: NextRequest) {
  try {
    const identity = getSignedIdentity(req);
    if (identity instanceof NextResponse) return identity;

    const use = await recordFeatureUse(identity);
    if (!use.allowed) {
      const body: PaywallDeniedBody = {
        error: 'Payment required',
        message: REASON_MESSAGES[use.status.reason],
        status: use.status,
      };
      return NextResponse.json(body, { status: 402 });
    }

    // ---- The paid work goes here. -----------------------------------------
    const result = { widgetId: `widget_${randomUUID().slice(0, 8)}` };
    // -----------------------------------------------------------------------

    return NextResponse.json({ status: use.status, result });
  } catch (error) {
    console.error('Error recording feature use:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { syncSubscription } from '@/lib/billing';
import { getStripeClient, getWebhookSecret, StripeEnvironment } from '@/lib/stripe';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Configure each webhook endpoint with a distinct query string, e.g.:
//   /api/stripe/webhook?mode=live&type=connected
//   /api/stripe/webhook?mode=test&type=connected
//   /api/stripe/webhook?mode=test&type=managed_sandbox
//   /api/stripe/webhook?mode=live&type=billing
//   /api/stripe/webhook?mode=test&type=billing
// Then read the params off the incoming request.
//
// type=billing is the endpoint in the account that charges your app's users
// (see src/lib/billing.ts): it receives the customer.subscription.* events
// that keep the `subscriptions` table — and therefore the paywall — current.
// It is verified with the billing account's credentials, which fall back to
// the app account's when you use one Stripe account for both.

export async function POST(req: NextRequest) {
  try {
    // Derive the environment from the query string params set on the
    // webhook endpoint in the Stripe Dashboard.
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');
    const type = searchParams.get('type');

    const environment: StripeEnvironment =
      type === 'managed_sandbox' ? 'managed_sandbox'
      : mode === 'live' ? 'live'
      : 'test';

    const isBilling = type === 'billing' && environment !== 'managed_sandbox';
    const stripe = isBilling
      ? getStripeClient(environment, 'billing')
      : getStripeClient(environment);
    const webhookSecret = isBilling
      ? getWebhookSecret(environment, 'billing')
      : getWebhookSecret(environment);

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'customer.created':
      case 'customer.updated': {
        const customer = event.data.object as Stripe.Customer;
        // Handle customer creation/update
        console.log('Customer event:', customer.id);
        break;
      }

      // Every subscription change — created, renewed, plan changed, payment
      // failed (past_due), cancelled (deleted) — is handled the same way:
      // write the subscription's current state. The event carries the full
      // object, including status 'canceled' on deletion, so there is no
      // per-event logic to get out of step.
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const synced = await syncSubscription(subscription);
        if (!synced) {
          // Not one of our users' customers (e.g. created by hand in the
          // Dashboard). Acknowledge it so Stripe doesn't retry.
          console.log('Subscription for an unknown customer, skipped:', subscription.id);
        }
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

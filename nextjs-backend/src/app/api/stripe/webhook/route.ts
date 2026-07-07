import { getStripeClient, getWebhookSecret, StripeEnvironment } from '@/lib/stripe';
import { getSupabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Configure each webhook endpoint with a distinct query string, e.g.:
//   /api/stripe/webhook?mode=live&type=connected
//   /api/stripe/webhook?mode=test&type=connected
//   /api/stripe/webhook?mode=test&type=managed_sandbox
// Then read the params off the incoming request.

// Stripe sends unix-second timestamps; Postgres wants ISO strings.
function toTimestamp(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

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

    const stripe = getStripeClient(environment);
    const webhookSecret = getWebhookSecret(environment);

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

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;

        // Find user by stripe customer ID
        const { data: customerRecord, error: customerError } = await getSupabase()
          .from('billing_customers')
          .select('user_id')
          .eq('stripe_customer_id', subscription.customer as string)
          .maybeSingle();
        if (customerError) throw customerError;

        if (customerRecord) {
          // Upsert subscription

          const item = subscription.items.data[0];

          const updatedSubscriptionValues = {
            status: subscription.status,
            price_id: item?.price.id ?? null,
            quantity: item?.quantity ?? null,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_start: toTimestamp(item?.current_period_start),
            current_period_end: toTimestamp(item?.current_period_end),
            ended_at: toTimestamp(subscription.ended_at),
            cancel_at: toTimestamp(subscription.cancel_at),
            canceled_at: toTimestamp(subscription.canceled_at),
            trial_start: toTimestamp(subscription.trial_start),
            trial_end: toTimestamp(subscription.trial_end),
            metadata: subscription.metadata,
            updated_at: new Date().toISOString(),
          };

          const { error } = await getSupabase()
            .from('billing_subscriptions')
            .upsert(
              {
                user_id: customerRecord.user_id,
                stripe_subscription_id: subscription.id,
                stripe_customer_id: subscription.customer as string,
                livemode: event.livemode,
                ...updatedSubscriptionValues,
              },
              { onConflict: 'stripe_subscription_id' }
            );
          if (error) throw error;
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        const { error } = await getSupabase()
          .from('billing_subscriptions')
          .update({
            status: 'canceled',
            ended_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);
        if (error) throw error;
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

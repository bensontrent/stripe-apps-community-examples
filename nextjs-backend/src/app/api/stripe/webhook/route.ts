import { db } from '@/db';
import { stripeCustomers, stripeSubscriptions } from '@/db/schema';
import { getStripeClient, getWebhookSecret, StripeEnvironment } from '@/lib/stripe';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Configure each webhook endpoint with a distinct query string, e.g.:
//   /api/stripe/webhook?mode=live&type=connected
//   /api/stripe/webhook?mode=test&type=connected
//   /api/stripe/webhook?mode=test&type=managed_sandbox
// Then read the params off the incoming request.

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
        const customerRecord = await db.query.stripeCustomers.findFirst({
          where: eq(stripeCustomers.stripeCustomerId, subscription.customer as string),
        });


        if (customerRecord) {
          // Upsert subscription

          const item = subscription.items.data[0];

          const updatedSubscriptionValues = {
            status: subscription.status,
            priceId: subscription.items.data[0]?.price.id,
            quantity: subscription.items.data[0]?.quantity?.toString(),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            currentPeriodStart: item.current_period_start ? new Date(item.current_period_start * 1000) : null,
            currentPeriodEnd: item.current_period_end ? new Date(item.current_period_end * 1000) : null,
            endedAt: subscription.ended_at ? new Date(subscription.ended_at * 1000) : null,
            cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
            trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
            trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
            metadata: subscription.metadata,
          }


          await db
            .insert(stripeSubscriptions)
            .values({
              ...{
                userId: customerRecord.userId,
                stripeSubscriptionId: subscription.id,
                stripeCustomerId: subscription.customer as string,
              },
              ...updatedSubscriptionValues
            }
            )
            .onConflictDoUpdate({
              target: stripeSubscriptions.stripeSubscriptionId,
              set: updatedSubscriptionValues,
            });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        await db
          .update(stripeSubscriptions)
          .set({
            status: 'canceled',
            endedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(stripeSubscriptions.stripeSubscriptionId, subscription.id));
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

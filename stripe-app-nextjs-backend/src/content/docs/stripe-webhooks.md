---
title: Stripe webhooks & cron
description: Receive Stripe events and run scheduled work.
order: 3
---

## The webhook endpoint

Stripe events arrive at `/api/stripe/webhook`
(`src/app/api/stripe/webhook/route.ts`). The route is listed in
`PUBLIC_ROUTES` so the proxy lets it through — authentication happens inside
the route by verifying the `stripe-signature` header with
`stripe.webhooks.constructEvent` and your webhook signing secret.

{% callout type="error" title="Never skip signature verification" %}
A webhook endpoint that trusts its payload without verifying the signature
lets anyone forge events — including `payment_intent.succeeded`. The signing
secrets live in the `STRIPE_APP_WEBHOOK_SECRET_*` environment variables, one
per mode (live / test / managed sandbox).
{% /callout %}

## Testing locally

Use the Stripe CLI to forward test events to your dev server:

```bash
stripe listen --forward-to localhost:3006/api/stripe/webhook
```

The CLI prints a `whsec_...` signing secret on startup — put it in
`STRIPE_APP_WEBHOOK_SECRET_TEST_CONNECTED` in `.env.local`. Then trigger a
test event from another terminal:

```bash
stripe trigger customer.subscription.created
```

## Scheduled work (cron)

`/api/cron` (`src/app/api/cron/route.ts`) is for scheduled jobs — syncing
subscriptions, sweeping expired records, and similar housekeeping. It is
listed in `BEARER_ONLY_ROUTES`, so callers **must** send an API key:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3006/api/cron
```

When deployed on Vercel, [cron jobs](https://vercel.com/docs/cron-jobs)
send `CRON_SECRET` as the bearer token automatically — no extra
configuration beyond setting the environment variable.

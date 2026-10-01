---
title: Stripe webhooks & cron
description: Receive Stripe events — installs, uninstalls, subscriptions — and run scheduled work.
order: 3
---

## Two webhooks, two files

A Stripe App that charges for itself listens to two different Stripe
accounts, for two different reasons:

| | App webhook | Billing webhook |
| --- | --- | --- |
| Route | `/api/webhooks/app` | `/api/webhooks/billing` |
| File | `src/pages/api/webhooks/app.ts` | `src/pages/api/webhooks/billing.ts` |
| Events come from | the accounts that **installed** your app, and your own account | the account that **charges** people for your app |
| Tells you | someone installed or uninstalled; a customer, invoice… changed in their account | someone subscribed, changed plan, stopped paying, cancelled |
| `event.account` | the installing account (`acct_…`) | not set |

Both routes are listed under `/api/webhooks` in `PUBLIC_ROUTES`, so the proxy
lets them through — authentication happens inside the route, by verifying
the `stripe-signature` header against the endpoint's signing secret.

{% callout type="error" title="Never skip signature verification" %}
A webhook endpoint that trusts its payload without verifying the signature
lets anyone forge events — including "this account subscribed". Each endpoint
you register has its own signing secret (`whsec_…`); they live in the
`STRIPE_WEBHOOK_SECRET_*` and `STRIPE_BILLING_WEBHOOK_SECRET_*` variables.
{% /callout %}

The signature is computed over the request body byte for byte, so both
routes switch Next's body parser off and read the raw bytes with
`readRawBody()` from `src/lib/webhooks.ts`:

```ts
export const config = { api: { bodyParser: false } };
```

They are the only two routes in the Pages Router (`src/pages/api`);
everything else is in `src/app`.

## The endpoints to register

One file serves every endpoint of its kind. The query string you give each
endpoint in the Stripe Dashboard tells the route which one is calling, and so
which secret to verify with.

| Endpoint URL | Create it in | Listening to | Signing secret goes in |
| --- | --- | --- | --- |
| `/api/webhooks/app?mode=live&type=connected` | your app's account, live mode | Connected accounts | `STRIPE_WEBHOOK_SECRET_LIVE_CONNECTED` |
| `/api/webhooks/app?mode=test&type=connected` | your app's account, test mode | Connected accounts | `STRIPE_WEBHOOK_SECRET_TEST_CONNECTED` |
| `/api/webhooks/app?mode=test&type=managed_sandbox` | the managed sandbox inside your app's account | Connected accounts | `STRIPE_WEBHOOK_SECRET_MANAGED_SANDBOX_CONNECTED` |
| `/api/webhooks/app?mode=live&type=account` | your app's account, live mode | Your account | `STRIPE_WEBHOOK_SECRET_LIVE_ACCOUNT` |
| `/api/webhooks/app?mode=test&type=account` | your app's account, test mode | Your account | `STRIPE_WEBHOOK_SECRET_TEST_ACCOUNT` |
| `/api/webhooks/billing?mode=live` | your billing account, live mode | Your account | `STRIPE_BILLING_WEBHOOK_SECRET_LIVE` |
| `/api/webhooks/billing?mode=test` | your billing account, test mode | Your account | `STRIPE_BILLING_WEBHOOK_SECRET_TEST` |

You don't need all seven on day one:

- **Connected** is the one every published app needs: it receives the events
  of the accounts that installed the app.
- **Managed sandbox** receives the same events for people who install the app
  into a sandbox. Stripe creates that sandbox inside your account; switch
  into it with the account picker to register the endpoint and copy its keys.
- **Account** is for events in your *own* account. That is where the app runs
  while you develop it, and where it always runs if it is private to your
  account. These events carry no `event.account`; set `STRIPE_APP_ACCOUNT_ID`
  to your own `acct_…` id and the route uses that instead.
- **Billing** is covered [below](#the-billing-webhook).

For Stripe to send an app the events of the accounts it is installed in, the
app needs the `event_read` permission plus the permission for each object it
listens to (`customer_read` for `customer.updated`, and so on):

```bash
stripe apps grant permission "event_read" "Read webhook event data"
```

## Installs and uninstalls

Stripe sends `account.application.authorized` when an account installs your
app and `account.application.deauthorized` when it uninstalls it. The app
webhook hands both to `src/lib/app-installs.ts`:

| | Install (`authorized`) | Uninstall (`deauthorized`) |
| --- | --- | --- |
| `stripe_accounts` | creates the row; stores the account's name and contact email | row is kept |
| Install state | writes the event id into `live_installation_id` or `test_installation_id` | sets that column back to `NULL` |
| Clean-up | — | deletes the account's Dashboard logins (`stripe_app_sessions`) |
| Email | welcome | "sorry to see you go" |

Three decisions in that file are worth understanding before you change it:

- **The contact email is saved at install.** Once the app is uninstalled,
  your API key can no longer read the account, so the goodbye email goes to
  the address stored in `stripe_accounts.email` on the way in.
- **The row is never deleted.** Settings and the
  [free trial](/docs/paywall) hang off it. Deleting it at uninstall would
  hand out a new trial with every reinstall.
- **A paid plan is not cancelled.** The subscription belongs to a user of
  this website and may cover other Stripe accounts too. The goodbye email
  says where to cancel it.

### The emails

Both templates are plain functions in `src/lib/email-templates.ts` —
`welcomeEmail()` and `goodbyeEmail()` — returning a subject, a text body and
an HTML body. They are samples; rewrite the wording, and set `APP_NAME` at
the top of the file. The welcome email quotes the trial from your
`TRIAL_DAYS_LIMIT` / `TRIAL_COUNT_LIMIT`, so it can't promise a different
trial than the paywall gives.

They are sent through Postmark (`src/lib/email.ts`). Without
`POSTMARK_SERVER_API_TOKEN` and `POSTMARK_FROM_EMAIL` nothing is sent and
the webhook says so in its response; the install is recorded either way. An
email that fails to send never fails the webhook.

One welcome and one goodbye are sent per **account**, not per mode: an
account that installs the app in test mode and later in live mode is
welcomed once, and gets the goodbye when its last install goes.

### Delivered at least once

Stripe may deliver the same event twice, and not always in order. Both
handlers therefore change the row with one conditional `UPDATE` — "mark
installed, but only if it wasn't" — and act only when a row comes back. A
repeated event changes nothing and emails nobody, and two deliveries racing
each other still produce exactly one welcome.

Write your own handlers the same way: make the database write decide whether
anything happened, then act on its result.

{% callout type="info" title="apps.install.* events" %}
Stripe also sends `apps.install.created`, `.updated` and `.deleted`
(`app.install.*` on API versions before 2026-09-30), whose payload is an App
Install object with its own id and the permissions granted. They describe
the same installs. Handle one family or the other for the welcome and
goodbye emails, not both.
{% /callout %}

## Which mode is an event in?

Use `event.livemode`, not the endpoint the event arrived at. When an account
has your app installed in both modes, Stripe sends that account's test-mode
events to your **live** endpoint as well as your test one. The app webhook
therefore picks the Stripe client from the event:

```ts
const environment =
  endpoint === 'managed_sandbox' ? 'managed_sandbox'
  : event.livemode ? 'live'
  : 'test';
```

The query string decides only which signing secret verifies the request.

## The billing webhook

Subscriptions your users buy on `/billing` live in your **billing** account
(see [Paywall, trials & billing](/docs/paywall)). Register a plain endpoint
there — "Your account", not connected accounts — per mode:

```
/api/webhooks/billing?mode=live
```

and subscribe it to `customer.subscription.created`, `.updated` and
`.deleted`. Every one of them is handled the same way: `syncSubscription()`
writes the subscription's current state into the `subscriptions` table,
which is what the paywall reads. A subscription whose customer isn't one of
your users is acknowledged and skipped.

When one Stripe account is both your app's account and your billing account,
leave the `STRIPE_BILLING_*` variables unset: the billing route then
verifies with `STRIPE_WEBHOOK_SECRET_<MODE>_CONNECTED`.

## Responses

| Status | Meaning |
| --- | --- |
| `200` | Verified. Handled, or a type the route doesn't handle — Stripe must get a 2xx for those too, or it keeps retrying. The body's `result` line says what happened and is shown next to the delivery in the Stripe Dashboard. |
| `400` | Missing or invalid signature. |
| `405` | Not a `POST`. |
| `500` | The signing secret isn't configured, or a handler threw. Stripe delivers the event again later. |

## Testing locally

Forward both kinds of event with one Stripe CLI session — `--forward-connect-to`
carries the events of connected accounts, `--forward-to` those of your own:

```bash
stripe listen --forward-connect-to "localhost:3006/api/webhooks/app?mode=test&type=connected" --forward-to "localhost:3006/api/webhooks/billing?mode=test"
```

The CLI prints one `whsec_…` signing secret for the session — put it in
`STRIPE_WEBHOOK_SECRET_TEST_CONNECTED` in `.env.local` (the billing route
falls back to it). Then trigger events from another terminal:

```bash
stripe trigger customer.subscription.created
```

```bash
stripe trigger account.application.deauthorized
```

The Stripe CLI has no trigger for `account.application.authorized`. To see a
real install, upload the app and install it in test mode or a sandbox on a
second account.

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

---
title: Paywall, trials & billing
description: Monetize your Stripe App — a per-account free trial limited by days and by usage, subscriptions sold on your own website, and a gate that holds on the backend.
order: 5
---

A Marketplace app gets paid the same way any SaaS does: the people who
install it subscribe to a plan in **your** Stripe account. This example
wires up the whole loop:

1. Every Stripe account gets **one free trial**, limited by days and by
   usage.
2. When the trial runs out, the app shows **how to subscribe** and links to
   the billing page on this backend.
3. The user subscribes through **Stripe Checkout**; the subscription is
   synced into the database.
4. The app **rechecks** and unlocks.

Test mode is never paywalled — nobody should pay to try your app on test
data.

| Piece | Where |
| ----- | ----- |
| The decision (shared, pure) | `src/types/paywall.ts` — identical copy in the Stripe App |
| Trial + subscription lookup | `src/lib/paywall.ts` |
| Routes the app calls | `src/app/api/stripe-app/paywall/` |
| Plans, Checkout, portal, sync | `src/lib/plans.ts`, `src/lib/billing.ts`, `src/config/plans.json` |
| Public price list (no login) | `src/app/(site)/plans/page.tsx` → `/plans` |
| Billing page (signed in) | `src/app/(site)/billing/page.tsx` → `/billing` |
| Database | two trial columns on `account_settings`, the `subscriptions` table, `start_account_trial` and `record_trial_usage` in `setup.sql` |
| In the app | `src/hooks/usePaywall.tsx`, `src/components/Paywall.tsx`, demo at `/examples/paywall` |

## Configuration

All optional. Set them in `.env.local`; they are read on every request.

| Variable | Default | Meaning |
| -------- | ------- | ------- |
| `TRIAL_DAYS_LIMIT` | `30` | Days a trial lasts once started. `0` = no time limit. |
| `TRIAL_COUNT_LIMIT` | `25` | Uses of the paid feature a trial includes, shared by the whole Stripe account. `0` = no usage cap. |
| `PAYWALL_ENFORCE_IN_TEST_MODE` | unset | `true` applies the paywall in test mode too, so you can rehearse it locally. Leave unset in production. |
| `BILLING_ENVIRONMENT` | `test` | Which mode `/billing` sells in. Set to `live` in production. |

The two limits give you three trial strategies without touching code:
time-boxed (`TRIAL_COUNT_LIMIT=0`), usage-capped (`TRIAL_DAYS_LIMIT=0`), or
both, where whichever runs out first ends the trial.

The limits are policy, not data: the database stores *when the trial
started* and *how much was used*, and the backend applies today's limits to
those facts. Raising `TRIAL_DAYS_LIMIT` therefore extends trials that are
already running.

## Where the trial is stored

There is no trials table. The trial is two columns on the account's
`account_settings` row, which already exists once per Stripe account per
mode:

| Column | Meaning |
| ------ | ------- |
| `trial_started_at` | When the trial started. `NULL` = not started. |
| `trial_usage_count` | Uses of the paid feature so far. |

They are real columns, **not keys in the `settings` jsonb**, on purpose:
that document is written by the app through `PATCH /api/stripe-app/settings`,
and a trial the client could edit would not be a trial. Only the two SQL
functions below write them. Because test and live are different rows,
rehearsing the paywall in test mode never uses up the live trial.

## Who is the customer?

Two different ids are in play, and keeping them apart is most of the design:

- **The trial belongs to the Stripe account** (`acct_…`). Everyone who uses
  the app in that account shares one trial clock and one allowance. The id
  comes from the signed request, so a trial needs **no login**.
- **The subscription belongs to a user** of this backend (a Better Auth
  account), because somebody has to log in to pay. The user's Stripe
  Customer id is stored on `users` (`stripe_customer_id_live` / `_test`).

The two meet in `memberships`: when a user logs in from inside a Stripe
account's Dashboard (see [Authentication](/docs/authentication)), they
become a member of that account. **An account is covered when any of its
members has a subscription in good standing.** One plan therefore covers
every Stripe account its owner works in.

{% callout type="info" title="Selling per Stripe account instead" %}
To charge per account, put the `acct_…` id in the subscription's metadata
when creating the Checkout session (`subscription_data.metadata` in
`createCheckoutSession`) and match on it in `findAccountSubscription()` in
`src/lib/paywall.ts`. Nothing else changes.
{% /callout %}

## The decision

`resolvePaywall()` in `src/types/paywall.ts` is the whole policy. The checks
run in this order, and the first that applies wins:

| # | Situation | `reason` | `view` | Access |
| - | --------- | -------- | ------ | ------ |
| 1 | Test mode | `test_mode` | `content` | granted |
| 2 | Subscription `active` or `trialing` | `subscribed` | `content` | granted |
| 3 | Subscription `past_due` | `payment_past_due` | `past-due` | denied |
| 4 | No trial row yet | `trial_not_started` | `intro` | denied |
| 5 | Trial older than `TRIAL_DAYS_LIMIT` | `trial_expired` | `trial-ended` | denied |
| 6 | Usage reached `TRIAL_COUNT_LIMIT` | `trial_limit_reached` | `trial-ended` | denied |
| 7 | Otherwise | `trialing` | `content` | granted |

Any other subscription status (`canceled`, `unpaid`, `incomplete`, `paused`…)
counts as no subscription and falls through to the trial checks.

The function is pure — facts in, `PaywallStatus` out — and an identical copy
lives in the Stripe App, where it drives the demo's preview and the unit
tests (`stripe-app/src/types/paywall.test.ts`). The app never uses it to
decide for real: it renders the `view` the backend sent.

The trial starts when someone **accepts it** (the `intro` view's button),
not at install. Nobody loses trial days to an app they haven't opened, and
no install webhook is needed. The start date is never cleared, so
reinstalling the app does not buy a second trial.

## Routes for the Stripe App

All use signed-request auth; all answer with a `PaywallStatus`.

| Route | What it does |
| ----- | ------------ |
| `GET /api/stripe-app/paywall` | The account's status |
| `POST /api/stripe-app/paywall/trial` | Start the trial (idempotent) |
| `POST /api/stripe-app/paywall/usage` | Use the paid feature — **the gate** |
| `POST /api/stripe-app/paywall/refresh` | Re-read subscriptions from Stripe ("Recheck my plan") |
| `DELETE /api/stripe-app/paywall/trial` | Reset the trial — `next dev` only, 404 otherwise |

```json
{
  "mode": "live",
  "enforced": true,
  "access": "granted",
  "reason": "trialing",
  "view": "content",
  "limits": { "trialCountLimit": 25, "trialDaysLimit": 30 },
  "trial": {
    "startedAt": "2026-09-29T19:40:11.000Z",
    "expiresAt": "2026-10-29T19:40:11.000Z",
    "daysRemaining": 30,
    "usageCount": 3,
    "usageRemaining": 22
  },
  "subscription": null
}
```

## The gate is on the backend

The app hides the paid feature when access is denied, but a UI is a
courtesy, not a lock: a signed request can be replayed from the browser's
network tab. The route that does the paid work must check for itself.
`recordFeatureUse()` is that check:

```ts
// src/app/api/stripe-app/paywall/usage/route.ts — the pattern to copy
const identity = getSignedIdentity(req);
if (identity instanceof NextResponse) return identity;

const use = await recordFeatureUse(identity);
if (!use.allowed) {
  return NextResponse.json(
    { error: 'Payment required', message: '…', status: use.status },
    { status: 402 },
  );
}

// …the paid work goes here, after the check…
```

It checks access and, during a trial, counts the use. Subscribers and test
mode pass through uncounted. A denied request gets **402 Payment Required**
with the status in the body, so the app can switch to the right view.

### Counting is atomic

With one free use left and two requests arriving together, reading the
count, comparing in JavaScript and writing `count + 1` lets both through.
`record_trial_usage()` in `setup.sql` does the check and the increment in
one `UPDATE`:

```sql
UPDATE account_settings
SET trial_usage_count = trial_usage_count + 1
WHERE stripe_account_id = p_account_id
  AND livemode = p_livemode
  AND trial_started_at IS NOT NULL
  AND (p_limit IS NULL OR trial_usage_count < p_limit)
RETURNING trial_usage_count;
```

No row updated means the allowance was already gone, and the request is
refused. (Verified with 35 simultaneous requests against a limit of 25:
exactly 25 succeeded.)

{% callout type="info" title="Can the mode header be trusted?" %}
The Stripe App signature covers the account and user ids, not the
`stripe-mode` header. Someone replaying a request could claim test mode to
skip the paywall — which is harmless **as long as the same value also
selects the data**: a request that says "test" must only ever touch
test-mode Stripe data (`getStripeClient('test')`). Derive the paywall mode
and the Stripe client from the same variable and the lie buys nothing. To
close the gap entirely, sign the mode too: pass it to
`fetchStripeSignature({ mode })` in the app and add it to the payload
`verifyStripeAppSignature()` checks.
{% /callout %}

## Plans

The plans in `src/config/plans.json` are **dummy data** — three made-up
plans. Replace them with your own; that file is the only place to edit.

```json
{
  "lookupKey": "community_example_pro_monthly",
  "name": "Pro",
  "description": "For teams that rely on the app every day.",
  "features": ["Everything in Starter", "Priority support"],
  "unitAmount": 2900,
  "currency": "usd",
  "interval": "month",
  "highlighted": true
}
```

Plans are tied to Stripe by **lookup key**, not price id. A price id is
different in test mode, in live mode and in every account; a lookup key is a
name you choose, works everywhere, and can be moved to a new price when you
change what a plan costs — no deploy.

To put real prices behind the catalogue:

```bash
npm run billing:seed
```

This creates a Product and Price per plan in your **test** billing account,
tagged with the lookup keys (`-- --live` does the same in live mode). It is
safe to re-run and never changes an existing price. Or create the prices by
hand in the Stripe Dashboard and give each one a lookup key.

Until a plan's price exists the billing page still lists it, marked as a
demo plan, so the page works on a fresh checkout.

## The public price list

`/plans` needs **no login** — it is in `PUBLIC_ROUTES` in `src/proxy.ts` and
reads nothing about the visitor. It shows the catalogue with live prices and
the trial terms (from the same limits the paywall enforces). Link to it from
anywhere a price is a question: the Stripe App does from every paywall view
(`plansPageUrl()` in its `src/api/backend.ts`), and it is the URL for your
Marketplace listing.

Buying still needs an account, so each plan's "Subscribe" links to
`/billing?subscribe_to=<lookup key>`. The proxy sends a signed-out visitor
through `/login` and back with the query string intact, and the billing page
continues straight to Stripe Checkout for that plan.

The page is a server component rendered per request, so `next build` never
needs a Stripe key. For real traffic, replace `dynamic = 'force-dynamic'`
with `revalidate = 300`.

## The billing page

`/billing` (session auth) shows the current plan with its status and renewal
date, the payment method on file, the plan list, and the Stripe accounts the
plan covers. It never handles card data:

| Action | Route | Goes to |
| ------ | ----- | ------- |
| Subscribe | `POST /api/protected/billing/checkout` with `{ lookupKey }` | Stripe Checkout |
| Manage plan | `POST /api/protected/billing/portal` | Stripe customer portal |

The browser sends a lookup key, never a price or an amount; the server
resolves it against the catalogue.

{% callout type="info" title="One-time portal setup" %}
Stripe needs the customer portal configured once per mode before it will
open: Dashboard → Settings → Billing → Customer portal → Save. Until then
"Manage plan" shows Stripe's error saying so.
{% /callout %}

## Keeping subscriptions in sync

`syncSubscription()` copies a Stripe subscription into the `subscriptions`
table. It runs from three places, so the table is right even when one is
missing:

1. **The webhook** — `customer.subscription.created`, `.updated` and
   `.deleted` on `/api/webhooks/billing?mode=test`
   (`mode=live` in production). This is what catches renewals, failed
   payments and cancellations nobody is watching.
2. **Every load of `/billing`** — so the page is right the moment the user
   returns from Checkout.
3. **"Recheck my plan" in the app** — `POST /api/stripe-app/paywall/refresh`.

Locally, 2 and 3 mean the flow works without `stripe listen`. In production
you want the webhook: create an endpoint in the **billing** account for the
three subscription events and put its signing secret in
`STRIPE_BILLING_WEBHOOK_SECRET_LIVE` (with a single Stripe account, the app
account's connected secret is used as the fallback).

## In the Stripe App

```tsx
<PaywallProvider context={context}>
  <Paywall context={context} unit="widget">
    <CreateWidgetForm />
  </Paywall>
</PaywallProvider>
```

`<Paywall>` renders the children when access is granted (with a line
showing what is left of a running trial), and otherwise the view the
backend asked for: the trial terms, or the three upgrade steps — log in,
open the billing page, recheck. `usePaywall()` exposes the status and the
actions for screens that need more control. If the status can't be loaded,
the feature stays hidden.

The demo at `/examples/paywall` also **previews every state** from made-up
data, so you can see what your users will see without waiting 30 days.

## Trying it locally

1. `npm run db:setup` — adds the trial columns and the two functions
   (safe on an existing database).
2. Add `PAYWALL_ENFORCE_IN_TEST_MODE=true` to `.env.local` and restart
   `npm run dev`.
3. `npm run billing:seed`, and save the test-mode customer portal settings.
4. In the app (`stripe apps start`), open `/examples/paywall`: start the
   trial, create widgets until the allowance runs out, follow the upgrade
   steps, pay with card `4242 4242 4242 4242`, and press "Recheck my plan".
5. "Reset the trial" starts over. Set `TRIAL_COUNT_LIMIT=3` to get there
   faster.

## Adapting it

- **Your feature instead of widgets:** call `recordFeatureUse()` at the top
  of your own route and wrap your UI in `<Paywall unit="shipment">`.
- **Different rules** (a grace period for past-due invoices, a trial that
  starts at install): change `resolvePaywall()` in **both** copies of
  `src/types/paywall.ts` and its tests. Nothing else encodes the policy.
- **Extending one account's trial:** add a nullable `trial_extended_until`
  column to `account_settings` (an `ALTER TABLE … ADD COLUMN` in a new
  `migrations/` file), pass it through `StoredTrial`, and prefer it over
  the computed expiry in `describeTrial()`.
- **Remove the dev reset:** delete the `DELETE` handler in
  `paywall/trial/route.ts` and `resetTrial()` before you ship.

---
title: Getting started
description: Run the backend locally and connect it to your Stripe App.
order: 1
---

## Prerequisites

- Node.js 20.9+
- The [Stripe CLI](https://docs.stripe.com/stripe-cli) with the `projects` plugin (`stripe plugin install projects`)
- A [Supabase](https://supabase.com) project (Postgres) for user accounts — free tier works; `npm run setup` can create one with you
- A [Stripe](https://stripe.com) account with your app installed in test mode

## Setup

{% steps %}

{% step title="Get the code" %}
Build a fresh copy with hosting already provisioned:

```bash
stripe projects build my-stripe-app-backend --template bensontrent/stripe-app-nextjs-backend
```

Or, from a clone of this repo, initialize Stripe Projects in place:

```bash
cd stripe-app-nextjs-backend
npm install
stripe projects init
stripe projects add vercel/project
```

Either way, the Vercel credentials land in `.env`.
{% /step %}

{% step title="Connect Supabase, generate secrets, create the tables" %}
```bash
npm run setup
```

It asks for your Supabase connection string and API keys (an existing
project or a new free one, into `public` or a dedicated schema), generates
every random secret into `.env.local`, copies your Stripe test key from
`stripe login`, and applies `setup.sql`. Re-run it any time — it only adds
what is missing.

One of its choices is to let Stripe Projects provision a brand-new Supabase
project instead (`stripe projects add supabase/project`). That connector
can't reuse an existing project or pick a schema, which is why it is an
option rather than the default.
{% /step %}

{% step title="Start the dev server" %}
```bash
npm run dev
```

The app runs at `http://localhost:3006`. The home page shows a checklist
of anything still missing (webhook secret, app signing secret).
{% /step %}

{% /steps %}

{% callout type="warning" title="Keep secrets out of git" %}
`.env.local` (written by `npm run setup`) and `.env` (written by Stripe
Projects) hold API keys and signing secrets. Both are gitignored —
never commit them, and never paste their values into client-side code.
{% /callout %}

## Key environment variables

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | Postgres connection string (used by Better Auth and `db:setup`) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase access, bypasses RLS |
| `SUPABASE_SCHEMA` | Optional dedicated schema instead of `public` |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Better Auth session signing |
| `STRIPE_SECRET_KEY_TEST` | Stripe API key (test mode) |
| `STRIPE_WEBHOOK_SECRET_TEST_CONNECTED` | Webhook signature verification |
| `STRIPE_APP_SIGNING_SECRET` | Verifies `stripe-signature` headers from your UI extension |
| `CRON_SECRET` | Bearer key for `/api/cron` (Vercel Cron sends it when set) |

The full list, with comments, is in `.env.example`. If Supabase was
provisioned through Stripe Projects, its variable names
(`SUPABASE_POOLER_URL`, `SUPABASE_PROJECT_URL`, `SUPABASE_SECRET_KEY`) are
mapped onto the ones above by `src/lib/env.ts`.

## Verify it works

Open `http://localhost:3006/docs` — this documentation is served by the
running app, publicly. Then open `http://localhost:3006/` and register an
account to exercise the Better Auth flow.

---
title: Getting started
description: Run the backend locally and connect it to your Stripe App.
order: 1
---

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (Postgres) for user accounts
- A [Stripe](https://stripe.com) account with your app installed in test mode

## Setup

{% steps %}

{% step title="Install dependencies" %}
From the `nextjs-backend` directory:

```bash
npm install
```
{% /step %}

{% step title="Configure environment variables" %}
Copy `.env.example` to `.env.local` and fill in your values. The full list
of variables — with comments — is typed in `src/types/env.d.ts`.
{% /step %}

{% step title="Create the database schema" %}
```bash
npm run db:setup
```

This creates the tables Better Auth and the app need in your Supabase
project.
{% /step %}

{% step title="Start the dev server" %}
```bash
npm run dev
```

The app runs at `http://localhost:3006`.
{% /step %}

{% /steps %}

{% callout type="warning" title="Keep secrets out of git" %}
`.env.local` holds live API keys and signing secrets. It is gitignored —
never commit it, and never paste its values into client-side code.
{% /callout %}

## Key environment variables

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | Postgres connection string (used by Better Auth) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase access |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Better Auth session signing |
| `STRIPE_APP_SECRET_KEY_TEST` | Stripe API key (test mode) |
| `STRIPE_APP_WEBHOOK_SECRET_TEST_CONNECTED` | Webhook signature verification |
| `STRIPE_APP_SECRET` | Verifies `stripe-signature` headers from your UI extension |
| `CRON_SECRET` | Bearer key for `/api/cron` (Vercel sends it automatically) |

## Verify it works

Open `http://localhost:3006/docs` — this documentation is served by the
running app, publicly. Then open `http://localhost:3006/` and register an
account to exercise the Better Auth flow.

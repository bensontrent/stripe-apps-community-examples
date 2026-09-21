# Quick Start Guide

## Prerequisites

- Node.js 20.9+
- [Stripe CLI](https://docs.stripe.com/stripe-cli) 1.43+ with the Projects plugin: `stripe plugin install projects`, then `stripe login`
- A Stripe account (test mode is fine)
- A Supabase account (free tier works) — the setup wizard creates the project with you if you don't have one yet, or can have Stripe Projects provision one

## Step-by-Step Setup

### 1. Get the code

**New backend from the template:**

```bash
stripe projects build my-stripe-app-backend --template bensontrent/stripe-app-nextjs-backend
cd my-stripe-app-backend
```

**Or from a clone of this repo:**

```bash
cd stripe-app-nextjs-backend
npm install
stripe projects init
stripe projects add vercel/project
```

Both leave the Vercel credentials in `.env`. `stripe projects status`
lists what was provisioned; `stripe projects env` lists the variable names.

### 2. Connect Supabase, generate secrets, create the tables

```bash
npm run setup
```

The wizard walks you through the database:

1. **Existing Supabase project** — click **Connect** in the project toolbar,
   copy the **Session pooler** connection string (replace `[YOUR-PASSWORD]`),
   then the project URL and secret (`service_role`) key from
   **Project Settings → API Keys**. Choose a dedicated schema instead of
   `public` if you're sharing a project you already use (then add that schema
   to **Exposed schemas** under Settings → API — the checklist verifies it).
2. **New free project** — it opens [database.new](https://database.new) and
   takes the same values.
3. **Provision with Stripe Projects** — runs `stripe projects add supabase/project`
   (brand-new project, `public` schema; its variables land in `.env` and are
   mapped by `src/lib/env.ts`). If the checklist later reports the secret key
   is missing, copy it from the dashboard and store it with
   `stripe projects variables set supabase-secret-key --env-key SUPABASE_SECRET_KEY`.

Then it generates `BETTER_AUTH_SECRET`, `URL_TOKEN_SECRET`,
`BEARER_TOKEN_KEYS`, `CRON_SECRET` and `DEV_API_KEY` into `.env.local`,
copies your Stripe test-mode key from the Stripe CLI login, and applies
`setup.sql`. It only adds what is missing — safe to re-run. `npm run setup --
--dry-run` shows what it would write.

<details>
<summary>Manual alternative</summary>

```bash
cp .env.example .env.local
```

Fill in `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
(optionally `SUPABASE_SCHEMA`), generate the secrets with
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
paste your Stripe test key, then `npm run db:setup` (or paste `setup.sql`
into the Supabase SQL editor).

</details>

### 3. Stripe Webhook Setup (Local Development)

```bash
# Forward webhooks (keep this running in a separate terminal)
stripe listen --forward-to localhost:3006/api/stripe/webhook
```

Copy the webhook signing secret that appears into `.env.local` as
`STRIPE_WEBHOOK_SECRET_TEST_CONNECTED`.

### 4. Run the Application

```bash
npm run dev
```

Visit <http://localhost:3006>. The home page shows a setup checklist with
anything still missing; it disappears once everything is green.

### 5. Test the Application

1. Go to <http://localhost:3006/login>
2. Create a new account
3. Sign in
4. Visit <http://localhost:3006/account> to see your account page

### 6. Connect the Stripe App

The UI extension that calls this backend lives in the
[stripe-app-community-example](https://github.com/bensontrent/stripe-app-community-example)
repo:

```bash
git clone https://github.com/bensontrent/stripe-app-community-example.git stripe-app
cd stripe-app && npm install && stripe apps start
```

Its `src/api/backend.ts` points at `http://localhost:3006` in development.

## Architecture Overview

### Authentication Flow

1. User signs up/in via Better Auth
2. Session stored in database and cookie
3. Proxy (middleware) checks authentication on protected routes
4. Client-side hooks provide session data

### Database Schema

- **users** / **sessions** / **auth_accounts** / **verifications**: Better Auth tables (`auth_accounts` = sign-in methods, not Stripe accounts); `users` also carries app-owned settings and the user's publisher-side Customer ids
- **stripe_accounts**: Connected Stripe accounts, one row per `acct_...` id — account settings and live/test install state live right on the row
- **memberships**: User ↔ Stripe account many-to-many, with the user's role and per-account settings
- **stripe_app_sessions**: Which app user is logged in inside the Stripe Dashboard
- **subscriptions**: Publisher-side monetization, synced from the billing account's webhooks

### API Structure

- `/api/auth/*`: Authentication endpoints (Better Auth)
- `/api/stripe-app/*`: Signed-request routes for the UI extension
- `/api/stripe/webhook`: Stripe event handler
- `/api/protected/*`: Authenticated API routes

## Common Tasks

### Add a New Protected Route

```typescript
// src/app/api/protected/my-route/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Your logic here
  return NextResponse.json({ data: 'Protected data' });
}
```

### Query the Database

```typescript
import { getSupabase } from '@/lib/supabase';

const supabase = getSupabase();

// Find user
const { data: user } = await supabase
  .from('users')
  .select('*')
  .eq('email', 'user@example.com')
  .maybeSingle();

// Insert user
await supabase.from('users').insert({
  email: 'new@example.com',
  name: 'New User',
});
```

### Handle Stripe Events

Edit `src/app/api/stripe/webhook/route.ts` to add new event handlers:

```typescript
switch (event.type) {
  case 'your.event.type':
    // Handle event
    break;
}
```

## Deployment Checklist

- [ ] `stripe projects add vercel/project` (if you didn't build from the template)
- [ ] `npm run deploy` — syncs env vars and deploys; see [DEPLOYMENT_QUICK_START.md](DEPLOYMENT_QUICK_START.md)
- [ ] Create production Stripe webhook endpoints and set their secrets
- [ ] Point the Stripe App at the deployed URL (`BACKEND_BASE` and `connect-src`)
- [ ] Use production Stripe keys for live mode
- [ ] Test authentication flow
- [ ] Test Stripe webhooks

## Troubleshooting

**Database connection fails:**

- Check the `DATABASE_URL` format; prefer the Session pooler string (the direct URL is IPv6-only)
- Verify the Supabase project is active
- Provisioned with Stripe Projects? `stripe projects env --pull` refreshes `.env`; a real value in `.env.local` overrides it

**Authentication not working:**

- Clear browser cookies
- Verify BETTER_AUTH_SECRET is set (`npm run setup` generates it)
- Check BETTER_AUTH_URL matches your domain

**Stripe webhooks not received:**

- Ensure Stripe CLI is running
- Check webhook secret matches
- Verify endpoint is accessible

## Next Steps

1. Customize the account page UI
2. Add more protected API routes
3. Implement Stripe App specific logic
4. Add email verification
5. Set up OAuth providers (Google, GitHub, etc.)
6. Add subscription management UI
7. Add RLS policies if you ever query Supabase from the browser (the backend's secret key bypasses RLS)

## Support

- Stripe Projects: <https://docs.stripe.com/projects>
- Better Auth: <https://better-auth.com/docs>
- Supabase: <https://supabase.com/docs>
- Stripe: <https://stripe.com/docs>

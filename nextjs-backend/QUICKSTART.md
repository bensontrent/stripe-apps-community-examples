# Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)
- A Stripe account (test mode)
- PostgreSQL database (via Supabase)

## Step-by-Step Setup

### 1. Environment Setup

**Easiest way:** run the one-time wizard from the repo root — it does everything in this section for you (generates secrets, connects Supabase, writes `.env.local`):

```bash
npm run setup
```

While the `delete_me_after_setup/` folder exists, <http://localhost:3030> shows a live checklist of anything still missing; delete the folder once it's green.

<details>
<summary>Manual alternative</summary>

1. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

2. Create a Supabase project:
   - Go to <https://supabase.com>
   - Create a new project
   - Wait for database to be ready

3. Get the connection string and API keys:
   - Click **Connect** in the project toolbar
   - Copy the **Session pooler** connection string to `DATABASE_URL` (replace `[YOUR-PASSWORD]`)
   - In **Project Settings → API Keys**, copy the project URL and `service_role` key to `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   - Optional: set `SUPABASE_SCHEMA` to install the tables into a dedicated schema instead of `public` — handy for reusing an existing project without using up a free-tier slot (then add that schema to **Exposed schemas** under Settings → API)

4. Generate Better Auth secret:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Add to `BETTER_AUTH_SECRET` (generate the proxy-auth secrets the same way — see `.env.example`)

5. Add Stripe keys:
   - Go to <https://dashboard.stripe.com/test/apikeys>
   - Copy keys to your `.env.local`

</details>

### 2. Database Setup

```bash
# Install dependencies
npm install

# Create the tables (applies setup.sql over DATABASE_URL)
npm run db:setup
```

Alternatively, paste `setup.sql` into the Supabase SQL editor and run it — same result. `setup.sql` is the single source of truth for the schema; edit it directly when you change the database.

With `SUPABASE_SCHEMA` set, `npm run db:setup` creates the dedicated schema, installs the tables there and grants the API roles access; use `npm run db:setup -- --print` if you'd rather paste the schema-qualified SQL into the SQL editor.

### 3. Stripe Webhook Setup (Local Development)

```bash
# Install Stripe CLI
# macOS: brew install stripe/stripe-cli/stripe
# Windows: scoop install stripe
# Linux: See https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login

# Forward webhooks (keep this running in a separate terminal)
stripe listen --forward-to localhost:3030/api/stripe/webhook
```

Copy the webhook signing secret that appears and add it to `.env.local` as `STRIPE_WEBHOOK_SECRET_TEST_CONNECTED`

### 4. Run the Application

```bash
npm run dev
```

Visit <http://localhost:3030>

### 5. Test the Application

1. Go to <http://localhost:3030/login>
2. Create a new account
3. Sign in
4. Visit <http://localhost:3030/account> to see your account page

## Architecture Overview

### Authentication Flow

1. User signs up/in via Better Auth
2. Session stored in database and cookie
3. Middleware checks authentication on protected routes
4. Client-side hooks provide session data

### Database Schema

- **users** / **sessions** / **auth_accounts** / **verifications**: Better Auth tables (`auth_accounts` = sign-in methods, not Stripe accounts)
- **stripe_accounts** + **stripe_account_users**: Connected Stripe accounts, many-to-many with users
- **stripe_app_installations**: Install state per account per livemode
- **stripe_account_settings** / **stripe_account_user_settings**: Account-wide and per-user settings, isolated per livemode
- **billing_customers** / **billing_subscriptions**: Publisher-side monetization (each user is a Customer in the publisher's Stripe account)

### API Structure

- `/api/auth/*`: Authentication endpoints (Better Auth)
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

- [ ] Set production environment variables
- [ ] Update `BETTER_AUTH_URL` to production domain
- [ ] Generate new `BETTER_AUTH_SECRET` for production
- [ ] Use production Stripe keys
- [ ] Create production Stripe webhook endpoint
- [ ] Confirm Row Level Security is enabled on every table (`setup.sql` does this)
- [ ] Test authentication flow
- [ ] Test Stripe webhooks

## Troubleshooting

**Database connection fails:**

- Check DATABASE_URL format
- Verify Supabase project is active
- Check firewall/IP restrictions

**Authentication not working:**

- Clear browser cookies
- Verify BETTER_AUTH_SECRET is set
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
7. Add RLS policies if you ever query Supabase from the browser (the backend's service-role key bypasses RLS)

## Support

- Better Auth: <https://better-auth.com/docs>
- Supabase: <https://supabase.com/docs>
- Stripe: <https://stripe.com/docs>

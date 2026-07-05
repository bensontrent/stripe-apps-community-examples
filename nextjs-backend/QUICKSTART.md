# Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)
- A Stripe account (test mode)
- PostgreSQL database (via Supabase)

## Step-by-Step Setup

### 1. Environment Setup

1. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

2. Create a Supabase project:
   - Go to <https://supabase.com>
   - Create a new project
   - Wait for database to be ready

3. Get Supabase credentials:
   - Go to Project Settings > API
   - Copy `URL` to `NEXT_PUBLIC_SUPABASE_URL`
   - Copy `anon public` key to `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy `service_role` key to `SUPABASE_SERVICE_ROLE_KEY`
   - Go to Project Settings > Database
   - Copy connection string to `DATABASE_URL`

4. Generate Better Auth secret:
\|\

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Add to `BETTER_AUTH_SECRET`

5. Add Stripe keys:
   - Go to <https://dashboard.stripe.com/test/apikeys>
   - Copy keys to your `.env.local`

### 2. Database Setup

```bash
# Install dependencies
npm install

# Push database schema to Supabase
npm run db:push
```

Alternatively, paste `setup.sql` into the Supabase SQL editor and run it — it creates the same tables. `setup.sql` is generated; after changing `src/db/schema.ts`, run `npm run db:generate` to write a migration and rebuild it.

### 3. Stripe Webhook Setup (Local Development)

```bash
# Install Stripe CLI
# macOS: brew install stripe/stripe-cli/stripe
# Windows: scoop install stripe
# Linux: See https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login

# Forward webhooks (keep this running in a separate terminal)
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret that appears and add it to `.env.local` as `STRIPE_WEBHOOK_SECRET`

### 4. Run the Application

```bash
npm run dev
```

Visit <http://localhost:3000>

### 5. Test the Application

1. Go to <http://localhost:3000/login>
2. Create a new account
3. Sign in
4. Visit <http://localhost:3000/account> to see your account page

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
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Find user
const user = await db.query.users.findFirst({
  where: eq(users.email, 'user@example.com'),
});

// Insert user
await db.insert(users).values({
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
- [ ] Enable Supabase Row Level Security (RLS)
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
7. Implement Row Level Security in Supabase

## Support

- Better Auth: <https://better-auth.com/docs>
- Drizzle ORM: <https://orm.drizzle.team/docs>
- Supabase: <https://supabase.com/docs>
- Stripe: <https://stripe.com/docs>

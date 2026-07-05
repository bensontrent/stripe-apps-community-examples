# Stripe App Backend with Drizzle ORM & Better Auth

A complete Next.js API backend with authentication (Better Auth + Supabase) and Drizzle ORM for building Stripe Apps with user account management.

## Features

- 🔐 **Authentication**: Better Auth with email/password and session management
- 🗄️ **Database**: Drizzle ORM with PostgreSQL (via Supabase)
- 💳 **Stripe Integration**: Webhook handling, customer & subscription management
- 🎯 **Stripe App Support**: API endpoints for Stripe App installations
- 👤 **User Account Page**: Complete account management UI
- 🔒 **Protected Routes**: Proxy-based authentication in several flavors — Better Auth sessions, Stripe App signatures, bearer tokens, a dev-only API key, and JWT-in-URL tokens (see [AUTHENTICATION.md](AUTHENTICATION.md))
- 🎨 **Modern Stack**: Next.js 16, TypeScript, Tailwind CSS

## Project Structure

```
backend/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...all]/     # Better Auth endpoints
│   │   │   ├── stripe/webhook/    # Stripe webhook handler (route-level auth)
│   │   │   ├── stripe-app/        # Stripe App signed-request routes
│   │   │   ├── public/            # Public routes with JWT-in-URL auth
│   │   │   ├── cron/              # Bearer-token-only route
│   │   │   └── protected/         # Session-protected API routes
│   │   ├── account/               # User account page
│   │   ├── login/                 # Login/signup page
│   │   └── page.tsx               # Home page
│   ├── db/
│   │   ├── schema.ts              # Database schema
│   │   └── index.ts               # Database connection
│   ├── lib/
│   │   ├── auth.ts                # Better Auth server config
│   │   ├── auth-client.ts         # Better Auth client hooks
│   │   ├── proxy-auth.ts          # Proxy auth helpers (all flavors)
│   │   ├── url-token.ts           # Short-lived JWT-in-URL tokens
│   │   └── stripe.ts              # Stripe clients & webhook secrets
│   └── proxy.ts                   # Auth proxy (Next.js 16 middleware)
├── drizzle.config.ts              # Drizzle configuration
├── .env.local                     # Environment variables
└── package.json
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required environment variables:

```env
# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://user:password@host:5432/database

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Better Auth
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
BETTER_AUTH_URL=http://localhost:3000

# Stripe (see src/lib/stripe.ts for the full list, incl. optional vars)
STRIPE_APP_SECRET_KEY_LIVE=sk_live_...
STRIPE_APP_SECRET_KEY_TEST=sk_test_...
STRIPE_APP_SECRET_KEY_MANAGED_SANDBOX=sk_test_...
STRIPE_APP_WEBHOOK_SECRET_LIVE_CONNECTED=whsec_...
STRIPE_APP_WEBHOOK_SECRET_TEST_CONNECTED=whsec_...
STRIPE_APP_WEBHOOK_SECRET_MANAGED_SANDBOX_CONNECTED=whsec_...

# Proxy authentication (see AUTHENTICATION.md)
STRIPE_APP_SECRET=absec_...          # Stripe App signing secret — only
                                     # exists after `stripe apps upload`
                                     # (uploading does NOT publish the app)
BEARER_TOKEN_KEYS=key-one,key-two    # Authorization: Bearer keys
CRON_SECRET=your-cron-secret         # sent by Vercel cron jobs
DEV_API_KEY=local-dev-only-key       # only works with `next dev`
URL_TOKEN_SECRET=your-url-token-secret  # signs JWT-in-URL tokens
```

### 3. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Get your database connection string from Settings > Database
3. Copy your API keys from Settings > API

### 4. Generate and Run Database Migrations

```bash
# Generate migration files from schema
npm run db:generate

# Push schema to database
npm run db:push

# Or run migrations
npm run db:migrate
```

### 5. Set Up Stripe Webhooks

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login to Stripe CLI: `stripe login`
3. Forward webhooks to local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
4. Copy the webhook signing secret to `.env.local`

### 6. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Database Schema

### Tables

Better Auth (sign-in):

- **users**: User accounts with email authentication, plus app-global `settings` jsonb
- **sessions**: Active user sessions
- **auth_accounts**: Sign-in methods (credential/OAuth) — Better Auth's "account" model, unrelated to Stripe accounts
- **verifications**: Email verification / password reset values

Merchant side (connected Stripe accounts; mode-specific tables carry a `livemode` flag so live and test data stay separate):

- **stripe_accounts**: Connected Stripe accounts, one row per `acct_...` id
- **stripe_account_users**: User ↔ Stripe account membership (many-to-many)
- **stripe_app_installations**: App install state per account per livemode
- **stripe_account_settings**: Account-wide settings per account per livemode
- **stripe_account_user_settings**: Per-user settings within an account, per livemode

Publisher side (monetization):

- **billing_customers**: Each user as a Customer in the app publisher's Stripe account, one per livemode
- **billing_subscriptions**: Subscription data synced from the publisher account

## API Endpoints

### Authentication

- `POST /api/auth/sign-up` - Create new account
- `POST /api/auth/sign-in` - Sign in with email/password
- `POST /api/auth/sign-out` - Sign out
- `GET /api/auth/session` - Get current session

### Protected Routes (Better Auth session)

- `GET /api/protected/stripe-app` - Get user's app installations
- `POST /api/protected/stripe-app` - Create/update app installation

### Stripe App Routes (signed-request auth)

- `GET /api/stripe-app/me` - Echo the verified Stripe identity
- `POST /api/stripe-app/token` - Mint a short-lived JWT-in-URL token

### Public Routes (route-level auth)

- `GET /api/public/download?token=...&account=...` - JWT-in-URL example

### Machine Routes (bearer token required)

- `GET /api/cron` - Example cron endpoint (`Authorization: Bearer <key>`)

### Webhooks (route-level auth)

- `POST /api/stripe/webhook` - Stripe webhook handler

See [AUTHENTICATION.md](AUTHENTICATION.md) for how each flavor works and how
the proxy routes requests between them.

## Usage Examples

### Client-Side Authentication

```typescript
import { signIn, signUp, signOut, useSession } from '@/lib/auth-client';

// Sign up
await signUp.email({
  email: 'user@example.com',
  password: 'password123',
  name: 'John Doe',
});

// Sign in
await signIn.email({
  email: 'user@example.com',
  password: 'password123',
});

// Use session in component
function MyComponent() {
  const { data: session, isPending } = useSession();
  
  if (isPending) return <div>Loading...</div>;
  if (!session) return <div>Not authenticated</div>;
  
  return <div>Hello {session.user.email}</div>;
}
```

### Server-Side Authentication

```typescript
import { auth } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });
  
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Use session.user.id, session.user.email, etc.
}
```

### Database Queries

```typescript
import { db } from '@/db';
import { users, stripeCustomers } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Find user by email
const user = await db.query.users.findFirst({
  where: eq(users.email, 'user@example.com'),
});

// Get user with Stripe customer
const userWithStripe = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: {
    stripeCustomer: true,
  },
});
```

## Stripe App Integration

### Installation Flow

1. User installs your Stripe App
2. Stripe redirects to your app with installation details
3. Your app creates an installation record:

```typescript
const response = await fetch('/api/protected/stripe-app', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    stripeAccountId: 'acct_xxx',
    installationId: 'install_xxx',
    settings: { /* app settings */ },
  }),
});
```

### Webhook Handling

The webhook handler automatically:
- Syncs customer data
- Updates subscription status
- Handles subscription lifecycle events

## Database Commands

```bash
# Generate migrations from schema changes
npm run db:generate

# Push schema directly to database (development)
npm run db:push

# Run migrations
npm run db:migrate

# Open Drizzle Studio (database GUI)
npm run db:studio
```

## Security Considerations

1. **Environment Variables**: Never commit `.env.local` to version control
2. **Webhook Signatures**: Always verify Stripe webhook signatures
3. **Session Security**: Better Auth handles secure session management
4. **Database**: Use Supabase Row Level Security (RLS) for additional protection
5. **API Routes**: Protected routes check authentication via middleware

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Environment Variables for Production

Update these in production:
- `BETTER_AUTH_URL` - Your production domain
- `BETTER_AUTH_SECRET` - Generate a new secure secret
- `STRIPE_WEBHOOK_SECRET` - Create production webhook endpoint
- Use production Stripe keys

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Check Supabase project is active
- Ensure IP is whitelisted in Supabase

### Authentication Not Working

- Clear browser cookies
- Verify `BETTER_AUTH_SECRET` is set
- Check `BETTER_AUTH_URL` matches your domain

### Stripe Webhooks Failing

- Verify webhook secret matches
- Check webhook endpoint is accessible
- Review Stripe dashboard webhook logs

## Additional Resources

- [Better Auth Documentation](https://better-auth.com)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe API Documentation](https://stripe.com/docs/api)
- [Next.js Documentation](https://nextjs.org/docs)

## License

MIT

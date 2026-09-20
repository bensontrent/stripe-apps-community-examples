# Stripe App Backend with Supabase & Better Auth

A complete Next.js API backend for a Stripe App: signed requests from the
Dashboard, a user login handshake, Better Auth sessions, Supabase Postgres and
Stripe webhooks. It is also a [Stripe Projects](https://docs.stripe.com/projects)
build template — one command gives you a fresh copy with Vercel hosting
already provisioned:

```bash
stripe projects build my-stripe-app-backend --template bensontrent/stripe-app-nextjs-backend
```

The companion Stripe App (the UI extension that runs inside the Dashboard and
calls this backend) lives in the
[stripe-apps-community-examples](https://github.com/bensontrent/stripe-apps-community-examples)
repo.

## Features

- 🔐 **Authentication**: Better Auth with email/password and session management
- 🗄️ **Database**: Supabase (Postgres) — tables created by one `setup.sql`, queried with `supabase-js`; use an existing project, a dedicated schema, or a fresh one
- 💳 **Stripe Integration**: Webhook handling, customer & subscription management
- 🎯 **Stripe App Support**: Signed-request routes and a Dashboard login handshake for your UI extension
- 👤 **User Account Page**: Complete account management UI
- 🔒 **Protected Routes**: Proxy-based authentication in several flavors — Better Auth sessions, Stripe App signatures, bearer tokens, a dev-only API key, and JWT-in-URL tokens (see [AUTHENTICATION.md](AUTHENTICATION.md))
- ☁️ **Stripe Projects**: Vercel provisioned from the CLI, credentials synced to `.env`, `npm run deploy` to ship (Supabase optionally too)
- 🎨 **Modern Stack**: Next.js 16, TypeScript, Tailwind CSS

## Project Structure

```
stripe-app-nextjs-backend/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...all]/     # Better Auth endpoints
│   │   │   ├── stripe/webhook/    # Stripe webhook handler (route-level auth)
│   │   │   ├── stripe-app/        # Stripe App signed-request routes + login handshake
│   │   │   ├── public/            # Public routes with JWT-in-URL auth
│   │   │   ├── cron/              # Bearer-token-only route
│   │   │   └── protected/         # Session-protected API routes
│   │   ├── (login)/               # Login, register, reset, Stripe App handshake pages
│   │   ├── (site)/                # Home (with setup checklist), account, docs
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── env.ts                 # Maps Stripe Projects' Supabase variable names onto the classic ones
│   │   ├── auth.ts                # Better Auth server config
│   │   ├── auth-client.ts         # Better Auth client hooks
│   │   ├── supabase.ts            # Supabase server client (secret / service-role key)
│   │   ├── proxy-auth.ts          # Proxy auth helpers (all flavors)
│   │   ├── url-token.ts           # Short-lived JWT-in-URL tokens
│   │   ├── stripe-app-session.ts  # Dashboard user ↔ app user login link
│   │   └── stripe.ts              # Stripe clients & webhook secrets
│   └── proxy.ts                   # Auth proxy (Next.js 16 middleware)
├── scripts/
│   ├── setup.mjs                  # `npm run setup` — Supabase, secrets, Stripe key, tables (idempotent)
│   ├── db-setup.mjs               # `npm run db:setup` — applies setup.sql
│   ├── deploy-vercel.mjs          # `npm run deploy` — env sync + production deployment
│   └── env.mjs                    # Shared env loading for the scripts
├── projects-template.yaml         # Stripe Projects build-template manifest (default variant)
├── projects-template.supabase-vercel.yaml  # Variant that also provisions Supabase
├── setup.sql                      # Database schema (single source of truth)
├── .env.example                   # Every variable, documented
└── package.json
```

## Setup

You need the [Stripe CLI](https://docs.stripe.com/stripe-cli) 1.43+ with the
Projects plugin (`stripe plugin install projects`) and `stripe login`.

### 1. Get the code

Build a fresh copy with hosting provisioned:

```bash
stripe projects build my-stripe-app-backend --template bensontrent/stripe-app-nextjs-backend
cd my-stripe-app-backend
```

Or initialize Stripe Projects inside a clone of this directory:

```bash
npm install
stripe projects init
stripe projects add vercel/project
```

Both write the Vercel credentials to `.env` (`stripe projects env --pull` refreshes it).

### 2. Connect Supabase and fill in the rest

```bash
npm run setup
```

The wizard asks where your Postgres lives and gives you three choices:

- **A Supabase project you already have** — paste its *Session pooler*
  connection string and API keys; optionally keep the tables in a dedicated
  schema (`SUPABASE_SCHEMA`) so the demo doesn't use up a free-tier slot.
- **A new free Supabase project you create** — it points you at
  [database.new](https://database.new) and takes the same values.
- **A new project provisioned by Stripe Projects** — runs
  `stripe projects add supabase/project` for you. Its credentials land in
  `.env` under the provider's names and [`src/lib/env.ts`](src/lib/env.ts)
  maps them onto the names the code reads. This connector always creates a
  brand-new project in `public`, which is why it is an option and not the default.

It then generates every random secret into `.env.local`, copies your Stripe
test-mode key from `stripe login`, and creates the tables from `setup.sql`.
It only adds what is missing, so re-run it whenever you like
(`--dry-run` shows what it would write; `--non-interactive` never prompts).

### 3. Run

```bash
npm run dev
```

Visit <http://localhost:3006>. The home page shows a live checklist of
anything still missing until every item is green.

What is left for you to do by hand, and when:

| Value | When | How |
|---|---|---|
| `STRIPE_WEBHOOK_SECRET_TEST_CONNECTED` | Before testing webhooks locally | `stripe listen --forward-to localhost:3006/api/stripe/webhook` prints it |
| `STRIPE_APP_SIGNING_SECRET` | After the first `stripe apps upload` of the companion app | Copy the "Signing secret" from your app's page in the Developers Dashboard into `.env.local` |
| Supabase **secret key** | Only with the Stripe Projects route, if the checklist says it's missing | `stripe projects open supabase` → Project Settings → API Keys, then `stripe projects variables set supabase-secret-key --env-key SUPABASE_SECRET_KEY` (or `.env.local`) |
| *Exposed schemas* | Only with a dedicated `SUPABASE_SCHEMA` | Supabase dashboard → Settings → API — the checklist verifies it |

<details>
<summary>Prefer manual setup?</summary>

```bash
cp .env.example .env.local
```

Fill in `DATABASE_URL` (Connect → Session pooler), `NEXT_PUBLIC_SUPABASE_URL`
and `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API Keys), generate the
secrets (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`),
paste your Stripe test key, then create the tables:

- **SQL editor:** paste [`setup.sql`](setup.sql) into the Supabase SQL editor and run it
  (`npm run db:setup -- --print` gives the schema-qualified version when `SUPABASE_SCHEMA` is set).
- **CLI:** `npm run db:setup`.

</details>

### Environment variables

- `.env.local` — the Supabase connection, every secret, your Stripe keys. Written by `npm run setup`.
- `.env` — credentials written by `stripe projects env --pull` (Vercel; Supabase too if provisioned that way). The CLI owns it. `.env.local` wins over it.

Every variable is documented in [`.env.example`](.env.example).

### Stripe webhooks (local)

```bash
stripe listen --forward-to localhost:3006/api/stripe/webhook
```

Copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET_TEST_CONNECTED` in `.env.local`.

## Database Schema

### Tables

Better Auth (sign-in):

- **users**: User accounts with email authentication, plus app-owned columns: `settings` jsonb and the user's Customer ids in the publisher's Stripe billing account (`stripe_customer_id_live` / `stripe_customer_id_test`)
- **sessions**: Active user sessions
- **auth_accounts**: Sign-in methods (credential/OAuth) — Better Auth's "account" model, unrelated to Stripe accounts
- **verifications**: Email verification / password reset values (also carries the short-lived Stripe App login handshake states)

Merchant side (connected Stripe accounts):

- **stripe_accounts**: One row per `acct_...` id (the Stripe id is the primary key), with account-wide `settings` jsonb and install state as two nullable columns (`live_installation_id` / `test_installation_id` — NULL means not installed in that mode)
- **memberships**: User ↔ Stripe account many-to-many, carrying the user's `role` in that account and their per-account `settings` jsonb
- **stripe_app_sessions**: Which app user is logged in inside the Stripe Dashboard, per dashboard user and Stripe account

Publisher side (monetization):

- **subscriptions**: Subscription data synced from the publisher account's webhooks (the `sub_...` id is the primary key)

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
- `POST /api/stripe-app/session` · `GET /api/stripe-app/verify` · `GET /api/stripe-app/userinfo` · `DELETE /api/stripe-app/session` - The Dashboard login handshake

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
import { getSupabase } from '@/lib/supabase';

const supabase = getSupabase();

// Find user by email
const { data: user } = await supabase
  .from('users')
  .select('*')
  .eq('email', 'user@example.com')
  .maybeSingle();

// Get user with their subscriptions (follows the foreign key, like a join)
const { data: userWithSubscriptions } = await supabase
  .from('users')
  .select('*, subscriptions(*)')
  .eq('id', userId)
  .maybeSingle();
```

## Stripe App Integration

### Installation Flow

1. User installs your Stripe App
2. Stripe redirects to your app with installation details
3. Your app registers the installation:

```typescript
const response = await fetch('/api/protected/stripe-app', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    stripeAccountId: 'acct_xxx',
    installationId: 'install_xxx',
    livemode: false,
    accountSettings: { /* shared by every member of the account */ },
    userSettings: { /* just for the current user in this account */ },
  }),
});
```

This upserts the `stripe_accounts` row (setting the mode's installation column) and the caller's `memberships` row — the first person to register an account becomes its `owner`.

### Webhook Handling

The webhook handler automatically:

- Syncs customer data
- Updates subscription status
- Handles subscription lifecycle events

## Database Commands

```bash
# Create all tables (no-op if they exist; honors SUPABASE_SCHEMA)
npm run db:setup

# Print the SQL it would run (schema-qualified when SUPABASE_SCHEMA is set)
npm run db:setup -- --print
```

To change the schema later, edit `setup.sql` (for fresh installs) and run matching `ALTER TABLE` statements against any database that already holds data — the Supabase SQL editor works well for both. Supabase's Table Editor doubles as a database GUI.

## Security Considerations

1. **Environment Variables**: Never commit `.env` or `.env.local` — both are gitignored
2. **Webhook Signatures**: Always verify Stripe webhook signatures
3. **Session Security**: Better Auth handles secure session management
4. **Database**: `setup.sql` enables Row Level Security on every table, so Supabase's auto-generated REST API exposes nothing to the publishable/anon key; keep the secret key server-side only
5. **API Routes**: Protected routes check authentication via the proxy

## Deployment

```bash
npm run deploy
```

Uses the Vercel credentials Stripe Projects wrote to `.env` to sync every
runtime variable to the Vercel project (with `BETTER_AUTH_URL` rewritten to
the production URL) and start a production deployment. Full walkthrough,
including the manual Vercel route and production webhooks, in
[DEPLOYMENT_QUICK_START.md](DEPLOYMENT_QUICK_START.md).

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` in `.env.local`; prefer the Session pooler string (the direct URL is IPv6-only)
- Check the Supabase project is active
- Provisioned through Stripe Projects? `stripe projects env --pull` refreshes `.env`, and the checklist on <http://localhost:3006> shows which variable each value came from

### Authentication Not Working

- Clear browser cookies
- Verify `BETTER_AUTH_SECRET` is set (`npm run setup` generates it)
- Check `BETTER_AUTH_URL` matches your domain

### Stripe Webhooks Failing

- Verify webhook secret matches
- Check webhook endpoint is accessible
- Review Stripe dashboard webhook logs

## Additional Resources

- [Stripe Projects](https://docs.stripe.com/projects) · [Build templates](https://docs.stripe.com/projects/templates)
- [Better Auth Documentation](https://better-auth.com)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe API Documentation](https://stripe.com/docs/api)
- [Next.js Documentation](https://nextjs.org/docs)

## License

MIT

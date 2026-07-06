# Deployment Quick Start (Vercel)

Get the backend running on Vercel. Do the [local setup](QUICKSTART.md) first
(`npm run setup` from the repo root) so you have a working `.env.local` to copy
values from.

## 1. Push the repo to GitHub

Vercel deploys from a Git repo. Fork or push this repo to your own GitHub
account.

## 2. Create the Vercel project

**Dashboard (easiest):** [vercel.com/new](https://vercel.com/new) → import your
repo → set **Root Directory** to `nextjs-backend` → deploy. The first deploy
will fail until the environment variables below are set — that's expected.

**CLI:** from `nextjs-backend/`, run `npx vercel link`, then `npx vercel` to
deploy.

## 3. Set the environment variables

In *Project → Settings → Environment Variables*, add everything from your
local `.env.local`, with these production changes:

| Variable | Production value |
|---|---|
| `BETTER_AUTH_URL` | `https://<your-project>.vercel.app` (or your custom domain) |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | Same as `BETTER_AUTH_URL` |
| `BETTER_AUTH_SECRET` | Generate a **fresh** secret — don't reuse the dev one |
| `URL_TOKEN_SECRET`, `BEARER_TOKEN_KEYS` | Fresh secrets too (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `DEV_API_KEY` | Omit — it's dev-only and ignored in production anyway |
| `CRON_SECRET` | Omit if you use [Vercel Cron](https://vercel.com/docs/cron-jobs) — Vercel sets it automatically |
| `NODE_ENV` | Omit — Vercel sets it |

CLI users: `npx vercel env pull .env.vercel` verifies what's set.

## 4. Database

Two common shapes:

- **Same Supabase project as dev** — copy `DATABASE_URL` (and `DB_SCHEMA` if
  you set one) as-is. Tables already exist from local setup.
- **Separate production project** (recommended once real users show up) —
  create a second Supabase project, set its connection string as
  `DATABASE_URL` in Vercel, and create the tables by running
  `npm run db:push` locally with `.env.local` temporarily pointed at the
  production `DATABASE_URL` (or paste `setup.sql` into its SQL editor —
  `public` schema only).

Prefer Supabase's **Session pooler** connection string — Vercel's serverless
functions benefit from pooling.

> The Vercel Marketplace also offers a Supabase integration that provisions a
> project and injects env vars automatically — note it names the connection
> string `POSTGRES_URL`, so copy that value into `DATABASE_URL`.

## 5. Stripe webhooks (production)

Local `stripe listen` doesn't apply to the deployed app. In the
[Stripe Workbench → Webhooks](https://dashboard.stripe.com/webhooks), create
endpoints pointing at your deployment, using the query params the handler
reads (see `src/app/api/stripe/webhook/route.ts`):

```text
https://<your-project>.vercel.app/api/stripe/webhook?mode=test&type=connected
https://<your-project>.vercel.app/api/stripe/webhook?mode=live&type=connected
```

Copy each endpoint's signing secret into the matching env var
(`STRIPE_WEBHOOK_SECRET_TEST_CONNECTED`, `STRIPE_WEBHOOK_SECRET_LIVE_CONNECTED`, …).

## 6. Redeploy and verify

Trigger a redeploy (env var changes need one), then:

- [ ] `https://<your-project>.vercel.app/login` — sign up and sign in works
- [ ] `/account` shows the logged-in account page
- [ ] Stripe Workbench shows webhook deliveries succeeding (2xx)
- [ ] The Stripe App points at the deployed backend URL where applicable

## Cleanup reminder

Deployment doesn't need the setup scaffolding: once local + deployed both
work, delete `nextjs-backend/delete_me_after_setup/`. (It's harmless if
deployed — the setup checklist never renders in production builds.)

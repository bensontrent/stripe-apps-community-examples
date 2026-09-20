# Deployment Quick Start (Vercel)

Get the backend running on Vercel. Do the [local setup](QUICKSTART.md) first
so `.env` and `.env.local` are complete — the deploy script copies from them.

## 1. Make sure a Vercel project exists

If you built from the template, Stripe Projects already created one. Otherwise:

```bash
stripe projects add vercel/project
```

Either way `.env` now holds `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`,
`VERCEL_TEAM_ID` / `VERCEL_ORG_ID` and `VERCEL_PROJECT_URL`
(`stripe projects env` lists them; `stripe projects env --pull` refreshes).

## 2. Deploy

```bash
npm run deploy
```

[`scripts/deploy-vercel.mjs`](scripts/deploy-vercel.mjs) does three things:

1. Reads `.env` and `.env.local`.
2. Syncs every runtime variable to the Vercel project's **production**
   environment. Along the way it:
   - rewrites `BETTER_AUTH_URL` and `NEXT_PUBLIC_BETTER_AUTH_URL` to
     `https://<VERCEL_PROJECT_URL>`;
   - adds the classic names (`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
     `SUPABASE_SERVICE_ROLE_KEY`) when Supabase was provisioned by Stripe
     Projects and only the provider names are set;
   - never uploads the Vercel credentials, `DEV_API_KEY`, `NODE_ENV` or
     `SUPABASE_DB_PASS`, and skips placeholder values.
3. Uploads the source files and starts a production deployment. Vercel runs
   `next build`.

It prints the deployment URL plus the two follow-ups below.

> Prefer fresh secrets in production? Generate new values for
> `BETTER_AUTH_SECRET`, `URL_TOKEN_SECRET` and `BEARER_TOKEN_KEYS` in the
> Vercel dashboard after the first deploy — the script upserts, so it won't
> overwrite values you change there unless they change locally too.

<details>
<summary>Manual alternative — Vercel dashboard or CLI</summary>

1. Push the repo to GitHub, then [vercel.com/new](https://vercel.com/new) →
   import → set **Root Directory** to `stripe-app-nextjs-backend` → deploy
   (the first deploy fails until the variables below are set — expected).
   CLI users: `npx vercel link` then `npx vercel` from this directory.
2. In *Project → Settings → Environment Variables*, add everything from
   `.env` and `.env.local` with these changes:

   | Variable | Production value |
   |---|---|
   | `BETTER_AUTH_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL` | `https://<your-project>.vercel.app` (or your custom domain) |
   | `BETTER_AUTH_SECRET`, `URL_TOKEN_SECRET`, `BEARER_TOKEN_KEYS` | Fresh secrets (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
   | `DEV_API_KEY`, `NODE_ENV`, `VERCEL_*` | Omit |

   If Supabase was provisioned with Stripe Projects, its names (`SUPABASE_POOLER_URL`,
   `SUPABASE_PROJECT_URL`, `SUPABASE_SECRET_KEY`) work as-is — `src/lib/env.ts` maps them.

</details>

## 3. Database

- **Same Supabase project as dev** — nothing to do; the tables already exist
  from `npm run setup`, and `npm run deploy` copies `DATABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (and `SUPABASE_SCHEMA`)
  from `.env.local` as-is.
- **Separate production project** (recommended once real users show up) —
  create a second Supabase project, paste `setup.sql` into its SQL editor (or
  run `npm run db:setup` with `.env.local` temporarily pointed at it), then set
  its connection string and keys in the Vercel dashboard after the first deploy.
  Provisioning it with Stripe Projects works too: `stripe projects env create
  production --output .env.production` then `stripe projects add supabase/project`.

Use the **Session pooler** connection string (`SUPABASE_POOLER_URL`) —
Vercel's serverless functions benefit from pooling, and the direct URL is
IPv6-only.

## 4. Stripe webhooks (production)

Local `stripe listen` doesn't apply to the deployed app. In
[Stripe Workbench → Webhooks](https://dashboard.stripe.com/webhooks), create
endpoints pointing at your deployment, using the query params the handler
reads (see `src/app/api/stripe/webhook/route.ts`):

```text
https://<your-project>.vercel.app/api/stripe/webhook?mode=test&type=connected
https://<your-project>.vercel.app/api/stripe/webhook?mode=live&type=connected
```

Copy each endpoint's signing secret into the matching variable
(`STRIPE_WEBHOOK_SECRET_TEST_CONNECTED`, `STRIPE_WEBHOOK_SECRET_LIVE_CONNECTED`, …)
in `.env.local`, then `npm run deploy` again to sync them.

## 5. Point the Stripe App at the backend

In the companion app:

- `stripe-app/src/api/backend.ts` → `BACKEND_BASE = 'https://<your-project>.vercel.app'`
- `stripe-app/stripe-app.json` → `connect-src: ["https://<your-project>.vercel.app/api/"]`

then `stripe apps upload`.

## 6. Verify

- [ ] `https://<your-project>.vercel.app/login` — sign up and sign in works
- [ ] `/account` shows the logged-in account page
- [ ] Stripe Workbench shows webhook deliveries succeeding (2xx)
- [ ] "Verify connection" in the Stripe App returns the signed identity

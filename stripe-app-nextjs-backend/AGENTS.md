# AGENTS.md — Stripe App backend (Next.js)

This is a working backend for a Stripe App, scaffolded from the
[stripe-apps-community-examples](https://github.com/bensontrent/stripe-apps-community-examples)
repo — either copied by hand or built with `stripe projects build` (template
`bensontrent/stripe-app-nextjs-backend`). The companion UI extension is
[stripe-app-community-example](https://github.com/bensontrent/stripe-app-community-example).
Your job is
to turn it into the backend of a specific Stripe App without breaking the
wiring that already works.

## Start here

1. Read `README.md`, then `AUTHENTICATION.md` (how requests from the Stripe
   Dashboard are verified) and `ARCHITECTURE.md` (tables, flows).
2. Look at `src/proxy.ts` (auth router), `src/lib/stripe.ts` (which Stripe
   credentials exist and why), `src/lib/env.ts` (how Stripe Projects' Supabase
   variable names map onto the ones the code reads) and `setup.sql` (the schema).
3. Check setup state with `npm run setup` (idempotent; `--non-interactive`
   when you have no terminal) or the checklist on `http://localhost:3006`
   under `npm run dev`.

## Database and Stripe Projects

- **Supabase is connected by `npm run setup`, not provisioned by Projects, by
  default.** The wizard takes an existing project's Session-pooler connection
  string and API keys, optionally into a dedicated schema (`SUPABASE_SCHEMA`),
  and writes them to `.env.local` under the classic names (`DATABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Stripe Projects'
  Supabase connector can only create a brand-new project in `public`, which is
  why it is offered as an option (inside the wizard, or
  `stripe projects add supabase/project`, or the `supabase-vercel` template
  variant) rather than the default.
- When Supabase *was* provisioned by Projects, its variables live in `.env`
  under provider names (`SUPABASE_POOLER_URL`, `SUPABASE_PROJECT_URL`,
  `SUPABASE_SECRET_KEY`, …). `src/lib/env.ts` (runtime) and `scripts/env.mjs`
  (CLI scripts) map them onto the classic names; classic names win. Add new
  aliases to both files.
- Hosting comes from Stripe Projects: `stripe projects status`,
  `stripe projects env` (names only), `stripe projects env --pull` (rewrites
  `.env`). Never hand-edit `.env` or anything under `.projects/`.
- Secrets Projects can't provide (Better Auth secret, bearer keys, Stripe
  keys, the app signing secret) live in `.env.local`, which wins over `.env`.
  `npm run setup` generates the random ones and reads the Stripe test key
  from the Stripe CLI login.
- `npm run deploy` syncs the runtime variables to the Vercel project and
  starts a production deployment (`scripts/deploy-vercel.mjs`). It rewrites
  `BETTER_AUTH_URL` to the Vercel URL and never uploads the Vercel token.

## Non-negotiables

- Keep `src/proxy.ts` stripping `x-auth-type` / `x-stripe-verified` from
  incoming requests before setting them — routes trust those headers.
- Schema changes go in `setup.sql` (fresh installs) **plus** matching
  `ALTER TABLE` statements for databases that already hold data. There is no
  migrations system.
- Better Auth's table/column mapping lives in `src/lib/auth.ts`; keep it in
  sync with the four auth tables in `setup.sql`.
- `setup.sql` enables Row Level Security on every table with no policies. The
  backend uses the secret/service-role key, which bypasses RLS; never ship
  that key to the browser.
- Keep the `/api/stripe-app/*` signed-request routes and the login handshake
  (`/stripe`, `/api/stripe-app/{session,verify,userinfo}`) working — the
  companion Stripe App depends on them.

## Verification

- `npm run build` must pass.
- With the dev server running, `http://localhost:3006` shows the setup
  checklist; every required item should be green before demoing.
- `/login` → register → `/account` exercises Better Auth end to end.
- From the Stripe App preview (`stripe apps start` in the companion repo),
  "Verify connection" must return the signed identity.

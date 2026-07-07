# AGENTS.md — notes for whoever picks this up next

Context: this repo is being prepared for a **Stripe Apps Community meetup**. The goal is a single Git repo containing two cooperating projects, with a root README and one `package.json` that installs both.

## Repo layout

- `stripe-app/` — Stripe App UI extension (`@stripe/ui-extension-sdk` 9.x, React 18). App id: `com.productivity.community-example`, display name "Community Example", drawer view. Run with `stripe apps start`.
- `nextjs-backend/` — Next.js 16 backend: Better Auth (email/password + sessions) over a direct `pg` connection, supabase-js for app data, Supabase Postgres, Stripe webhook handler. Has its own good docs: `README.md`, `QUICKSTART.md`, `ARCHITECTURE.md`, `DEPLOYMENT_QUICK_START.md`.
- Root `package.json` — no npm workspaces (deliberate, see below). `postinstall` runs `npm install --prefix` in each subfolder, so a single `npm install` at the root sets up everything. `npm run dev` uses `concurrently` to run both.

## Decisions made (and why)

- **No npm workspaces.** The Stripe CLI builds the app from `stripe-app/` and expects its dependencies locally; hoisting to a root `node_modules` is a risk not worth taking days before a live demo. `--prefix` scripts are boring and reliable.
- **`postinstall` chains the two installs** so `npm install` at root "just works" for meetup attendees.
- Root README intentionally stays high-level and links into `nextjs-backend/`'s existing docs rather than duplicating them.

## Known quirks / mismatches

All addressed 2026-07-05, except one leftover file:

- ~~`stripe` SDK version mismatch~~ — **DONE:** `stripe-app` bumped from `20.1.0` to `21.0.0` to match the backend. (`@stripe/ui-extension-sdk` peer-requires `stripe >= 8.195.0`, so this is compatible.)
- ~~Name mismatch~~ — **DONE:** app renamed everywhere to id `com.productivity.community-example` (display name "Community Example") in both `stripe-app.json` and `stripe-app/package.json`. The root README now warns users to pick their own globally-unique app id before their first `stripe apps upload`.
- ~~"Next.js 15" doc drift~~ — **DONE:** `nextjs-backend/README.md` now says Next.js 16.
- ~~Mangled QUICKSTART.md~~ — **DONE:** rewritten with proper code fences (the old file had backticks eaten by a bad shell write).
- ~~`nextjs-backend/auth-schema.ts` dead code~~ — **DONE:** deleted with user approval. It was a stale `@better-auth/cli generate` artifact nothing imported.

## Database workflow (Drizzle removed 2026-07-07)

- **Drizzle was removed on 2026-07-07** to keep the tutorial simple (`drizzle-orm`, `drizzle-kit`, `postgres`, `src/db/`, `drizzle.config.ts` and the `drizzle/` migrations are all gone). Data access is now plain **supabase-js** (`src/lib/supabase.ts`, service-role key, lazily created — server-side only) and Better Auth connects directly over `DATABASE_URL` with a `pg` Pool.
- `nextjs-backend/setup.sql` is now the **single source of truth** for the database (all 11 tables + FKs + RLS enablement). It is hand-maintained — edit it directly. Users apply it by pasting into the Supabase SQL editor or with `npm run db:setup` (`scripts/db-setup.mjs`, runs it over `DATABASE_URL`).
- **Rule: schema changes = edit `setup.sql`** (fresh installs) **+ run matching `ALTER TABLE` against any database that already has data.** There is no migrations system anymore.
- `setup.sql` enables Row Level Security on every table with no policies: Supabase's auto REST API exposes `public`, so the anon key must be locked out; the backend's service-role key bypasses RLS.
- **Schema structure (2026-07-05)** — three prefixes (rationale in the header of `setup.sql`): `auth_*` = Better Auth models; `stripe_*` = merchant side — `stripe_accounts` (one row per `acct_` id), `stripe_account_users` (users ↔ Stripe accounts many-to-many), and per-`livemode` child tables `stripe_app_installations` / `stripe_account_settings` / `stripe_account_user_settings` so live and test settings never bleed; `billing_*` = publisher-side monetization (`billing_customers` one per user per livemode, `billing_subscriptions`).
- **Better Auth mapping is non-default:** `src/lib/auth.ts` maps Better Auth's `user`/`session`/`account`/`verification` models onto `users`/`sessions`/`auth_accounts`/`verifications` via `modelName`/`fields` (snake_case columns) with `uuid` ids (`generateId: () => crypto.randomUUID()`). Better Auth's own defaults are singular names + camelCase columns + text ids. `auth_accounts` is deliberately not called `accounts` to avoid confusion with Stripe accounts. When changing the four auth tables, keep the columns Better Auth expects and update the `fields` maps in `auth.ts`.
- **Custom schema support (`SUPABASE_SCHEMA`, added 2026-07-07):** the Drizzle-era `DB_SCHEMA` option was rebuilt first-class so users can reuse an existing Supabase project without burning a free-tier slot. It threads through four places: `scripts/db-setup.mjs` (creates the schema, rewrites `"public"` refs, grants API roles; `-- --print` emits the SQL for the SQL editor), `src/lib/supabase.ts` (exports validated `dbSchema`, passes `db: { schema }` to supabase-js), `src/lib/auth.ts` (sets `search_path` per pool connection — needs the session pooler, not the transaction pooler), and the setup checklist/wizard. The one step SQL can't automate: the schema must be added to "Exposed schemas" in the Supabase dashboard (Settings → API) — the checklist probes PostgREST and flags it.
- ~~`git init` before schema changes~~ — **DONE (2026-07-05):** repo initialized on `main` with initial commit `d0a71d6`. Verified `.gitignore` works: `node_modules/` and `.env.local` do not appear in `git status`. Note the initial commit predates the 2026-07-05 quirk fixes (app rename, stripe 21 bump, setup.sql workflow, auth-schema.ts deletion) — those are uncommitted in the working tree and should be the next commit.

## Authentication framework (added 2026-07-05)

`nextjs-backend/src/proxy.ts` is now a multi-flavor auth router (Next.js 16 "proxy" = the old middleware). Full docs in `nextjs-backend/AUTHENTICATION.md`. The pieces:

- `src/lib/proxy-auth.ts` — verification helpers: Stripe App signature (`stripe-signature` header vs `STRIPE_APP_SECRET`), bearer keys (`BEARER_TOKEN_KEYS`/`CRON_SECRET`), dev-only key (`DEV_API_KEY`, NODE_ENV=development only), user API keys (stubbed TODO — future DB lookup), CORS helpers.
- `src/lib/url-token.ts` — short-lived JWT-in-URL tokens (`jose`, HS256, `URL_TOKEN_SECRET`), verified at the route level; path + account bound.
- Example routes, one per flavor: `/api/stripe-app/me` (signature), `/api/stripe-app/token` (mints URL tokens), `/api/public/download` (JWT-in-URL, public in proxy), `/api/cron` (bearer-only).
- The proxy strips `x-auth-type`/`x-stripe-verified` from incoming requests and sets them after verification — routes trust them; never remove that stripping.
- Ported from Parcelcraft's `middleware.ts`/`auth.ts` references; Firebase intentionally dropped (Better Auth is the session layer).
- `.env.example` was rewritten and now matches `lib/stripe.ts` (it was stale) plus the new auth vars; `src/types/env.d.ts` matches.
- `stripe-app/src/api/backend.ts` — signed-fetch client (`fetchStripeSignature`) with example calls; `stripe-app.json` CSP `connect-src` now lists `http://localhost:3000/api/` + a placeholder https URL users must replace before publishing.
- New dep: `jose` in nextjs-backend.

## Suggested next session tasks

1. Commit the pending working-tree changes (quirk fixes + schema workflow + auth framework — see `git status`). Commit lockfiles for reproducible installs.
2. Frontend examples in the Stripe App UI: a view that calls `getMe()`/`createDownloadLink()` from `src/api/backend.ts`; a Better Auth login flow (model on Parcelcraft `Login.tsx`, minus Firebase); an API-key Settings view using `stripe.apps.secrets` (model on rtk-mobile `Settings.tsx`).
3. Future work: user API keys table in `setup.sql` (hashed keys) + DB lookup in `verifyApiKey()` — remember to ship matching `ALTER TABLE`/`CREATE TABLE` SQL for existing databases.
4. Optional: add a top-level `docs/` or slides link for the meetup.

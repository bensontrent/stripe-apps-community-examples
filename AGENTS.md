# AGENTS.md — notes for whoever picks this up next

Context: this repo is the quickstart example for the **Stripe Apps Community meetup**: a Stripe App (UI extension) plus a Next.js backend. Since 2026-09-20 the backend is published as a **Stripe Projects build template** and the Stripe App is meant to live in its own repo, referenced here as a submodule.

## Repo layout

- `stripe-app-nextjs-backend/` — Next.js 16 backend **and the Stripe Projects template**: Better Auth (email/password + sessions) over a direct `pg` connection, supabase-js for app data, Supabase Postgres, Stripe webhook handler, signed-request routes + Dashboard login handshake. Own docs: `README.md`, `QUICKSTART.md`, `ARCHITECTURE.md`, `AUTHENTICATION.md`, `DEPLOYMENT_QUICK_START.md`, and a consumer-facing `AGENTS.md` that ships with the template. Manifest: `projects-template.yaml`.
- `stripe-app/` — Stripe App UI extension (`@stripe/ui-extension-sdk` 9.x, React 18). App id `com.productivity.community-example`, display name "Community Example", drawer view. Run with `stripe apps start`. Self-contained (own README, LICENSE, .gitignore) so it can be split into its own repo.
- Root `package.json` — no npm workspaces (deliberate, see below). `postinstall` runs `npm install --prefix` in each subfolder. `npm run dev` uses `concurrently` to run both.

## Stripe Projects conversion (2026-09-20)

What "publishing as a Stripe Project" means: a **build template** = a public GitHub repo (or subdirectory) + a YAML manifest PR'd into [stripe/projects-template-registry](https://github.com/stripe/projects-template-registry). `stripe projects build --template <id>` copies the files at a pinned commit, runs `install_command`, provisions the `services`, and prints `next_steps`. Docs: <https://docs.stripe.com/projects/templates>. Stripe's own templates: <https://github.com/stripe/projects-templates> (MIT — `scripts/deploy-vercel.mjs` is adapted from `nextjs_saas_amber-fox`).

Decisions:

- **Template = the `stripe-app-nextjs-backend/` subdirectory** of this repo (`repo:` in the manifest is a `/tree/main/stripe-app-nextjs-backend` URL). The Stripe App is *not* part of the template; the manifest's next steps tell users to `git clone` it.
- **Services:** `supabase/project` + `vercel/project`, both with free `tier_plans`. Provider capabilities checked 2026-09-20: neither Supabase nor Vercel supports `existing_resource_linking`, so every build provisions a fresh Supabase project (uses a free-tier slot) — the docs keep the "bring your own Supabase via `.env.local`" path for that reason.
- **Env var names.** Supabase's provider writes `SUPABASE_PROJECT_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_URL`, `SUPABASE_POOLER_URL`, `SUPABASE_DB_PASS` (names taken from PostHog's and Mixpanel's published Supabase templates; **whether a `SUPABASE_SECRET_KEY` is emitted is unverified** — no real provisioning was run). Vercel writes `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_URL`. Rather than rename everything, `src/lib/env.ts` (runtime) and `scripts/env.mjs` (CLI scripts) map provider names onto the classic names the code reads (`DATABASE_URL` ← `SUPABASE_POOLER_URL`|`SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL` ← `SUPABASE_PROJECT_URL`, `SUPABASE_SERVICE_ROLE_KEY` ← `SUPABASE_SECRET_KEY`, anon ← `SUPABASE_PUBLISHABLE_KEY`). Classic names win; placeholders from `.env.example` count as unset. **Keep the two tables in sync.** Verify the secret-key question on the first real `stripe projects add supabase/project`; if it isn't emitted, the checklist/setup already tell users to store it with `stripe projects variables set … --env-key SUPABASE_SECRET_KEY`.
- **Two env files.** `.env` is owned by `stripe projects env --pull` (provider creds). `.env.local` holds everything else and wins (Next.js precedence). Both gitignored; `.projects/cache` and `.projects/vault` gitignored, `state.json`/`state.local.json` are meant to be committed *by template consumers* (this repo itself is not `stripe projects init`ed).
- **`delete_me_after_setup/` is gone.** Replaced by `scripts/setup.mjs` — non-interactive, append-only, idempotent: generates the random secrets, takes the Stripe test key from `stripe config --list` (amber-fox trick; accepts `sk_test_`/`rk_test_`), creates the tables via `ensureTables()` exported from `scripts/db-setup.mjs` (which only runs `main()` when invoked directly). Provisioning happens *after* `install_command`, so table creation must be a `next_steps` command, not part of install. `SetupChecklist.tsx` no longer depends on a folder existing: dev-only, hides itself when every item is green, and labels values with the provider variable they came from.
- **Deploy:** `npm run deploy` (`scripts/deploy-vercel.mjs`) — REST-only, no Vercel CLI: syncs `.env`+`.env.local` (minus a denylist, plus resolved classic names, `BETTER_AUTH_URL` rewritten to `https://<VERCEL_PROJECT_URL>`) to the project's production env, uploads files (skipping `.projects/`, `.env*`, `.next`, `node_modules`), creates a deployment. Untested against a real Vercel project.
- **Names fixed while here:** docs/hints referred to `STRIPE_APP_SECRET` and `STRIPE_APP_SECRET_KEY_*`; the code reads `STRIPE_APP_SIGNING_SECRET` and `STRIPE_SECRET_KEY_*`. `env.d.ts`, `backend.ts` hints and the docs now match the code. `CRON_SECRET` is *not* set automatically by Vercel — Vercel sends it as a bearer token when you set it (docs corrected).
- **Manual/outward steps left for the maintainer** (not done by the agent): create the public repo for `stripe-app/` (manifest assumes `bensontrent/stripe-app-community-example`), convert `stripe-app/` to a submodule, push, pin `ref` in `projects-template.yaml`, run an end-to-end `stripe projects build --template-manifest …` (it creates a real Stripe project + Supabase/Vercel resources), then PR the manifest to the registry as `stripe_app_backend/supabase-vercel.yaml`. `guided.category: stripe_app` is not a first-class category, so it lists under "Something else".
- Machine note: `stripe projects list` on this account already shows an empty project `nextjs-for-stripe-apps-marketplace` (created 2026-08-12). The projects plugin was upgraded 0.32 → 0.41 on 2026-09-20.

## Decisions made earlier (and why)

- **No npm workspaces.** The Stripe CLI builds the app from `stripe-app/` and expects its dependencies locally; hoisting to a root `node_modules` is a risk not worth taking. `--prefix` scripts are boring and reliable. With the submodule, `npm install` at root needs `git submodule update --init` first.
- Root README stays high-level and links into the backend's docs rather than duplicating them.

## Database workflow (Drizzle removed 2026-07-07)

- Data access is plain **supabase-js** (`src/lib/supabase.ts`, secret/service-role key, lazily created — server-side only) and Better Auth connects directly over `DATABASE_URL` with a `pg` Pool.
- `stripe-app-nextjs-backend/setup.sql` is the **single source of truth** for the database (8 tables + FKs + indexes + RLS enablement). Hand-maintained. Applied by `npm run setup` / `npm run db:setup` (`scripts/db-setup.mjs`, `--print` emits schema-qualified SQL for the SQL editor) or by pasting into the SQL editor.
- **Rule: schema changes = edit `setup.sql`** (fresh installs) **+ run matching `ALTER TABLE` against any database that already has data.** No migrations system.
- RLS is enabled on every table with no policies: Supabase's auto REST API exposes `public`, so the anon/publishable key must be locked out; the backend's secret key bypasses RLS.
- **Schema structure (redesigned 2026-07-20; 8 tables):** Better Auth models (`users`, `sessions`, `auth_accounts`, `verifications` — `users` also carries app-owned `settings` jsonb and `stripe_customer_id_live`/`_test`); merchant side (`stripe_accounts` keyed by `acct_` id with `settings` + `live_installation_id`/`test_installation_id`; `memberships` user ↔ account with `role` owner/admin/member and per-account `settings`); `stripe_app_sessions` (dashboard login link); publisher side (`subscriptions` keyed by `sub_` id). Conventions: Stripe ids are natural primary keys; `livemode` only where Stripe itself splits data; `timestamptz` everywhere; every FK column indexed.
- **Better Auth mapping is non-default:** `src/lib/auth.ts` maps `user`/`session`/`account`/`verification` onto `users`/`sessions`/`auth_accounts`/`verifications` via `modelName`/`fields` (snake_case) with `uuid` ids. `auth_accounts` is deliberately not `accounts` to avoid confusion with Stripe accounts. When changing the four auth tables, keep the columns Better Auth expects and update the `fields` maps.
- **Custom schema support (`SUPABASE_SCHEMA`):** threads through `scripts/db-setup.mjs` (creates the schema, sets `search_path`, grants API roles), `src/lib/supabase.ts` (validated `dbSchema`, `db: { schema }`), `src/lib/auth.ts` (`search_path` per pool connection — needs the session pooler), and the checklist/setup. The one step SQL can't automate: add the schema to "Exposed schemas" in the Supabase dashboard — the checklist probes PostgREST and flags it.

## Authentication framework (added 2026-07-05)

`stripe-app-nextjs-backend/src/proxy.ts` is a multi-flavor auth router (Next.js 16 "proxy" = the old middleware). Full docs in `AUTHENTICATION.md`. The pieces:

- `src/lib/proxy-auth.ts` — verification helpers: Stripe App signature (`stripe-signature` header vs `STRIPE_APP_SIGNING_SECRET`), bearer keys (`BEARER_TOKEN_KEYS`/`CRON_SECRET`), dev-only key (`DEV_API_KEY`, NODE_ENV=development only), user API keys (stubbed TODO — future DB lookup), CORS helpers.
- `src/lib/url-token.ts` — short-lived JWT-in-URL tokens (`jose`, HS256, `URL_TOKEN_SECRET`), verified at the route level; path + account bound.
- Example routes, one per flavor: `/api/stripe-app/me` (signature), `/api/stripe-app/token` (mints URL tokens), `/api/public/download` (JWT-in-URL, public in proxy), `/api/cron` (bearer-only).
- The proxy strips `x-auth-type`/`x-stripe-verified` from incoming requests and sets them after verification — routes trust them; never remove that stripping.
- `stripe-app/src/api/backend.ts` — signed-fetch client (`fetchStripeSignature`) with example calls, pointing at `http://localhost:3006` in dev; `stripe-app.json` CSP `connect-src` lists a placeholder https URL users must replace before publishing. The backend dev server runs on port **3006**.

## Stripe App user login flow (added 2026-07-20)

- **Handshake:** the app mints a `state` UUID, opens `{backend}/stripe?state=…` in a browser tab, and polls `GET /api/stripe-app/verify?state=…` (signed). The `/stripe` page (session auth) POSTs the state to `/api/stripe-app/session`; verify claims it, writes `stripe_app_sessions` (+ `memberships`, first = owner), and consumes the state (one-shot). `GET /api/stripe-app/userinfo` resolves the signed dashboard identity thereafter; logout = `DELETE /api/stripe-app/session` + the `/stripe-logout` page. Full docs: `AUTHENTICATION.md` ("The Stripe App user login flow").
- **Tables:** `stripe_app_sessions` (PK stripe_account_id + stripe_user_id). Handshake states reuse Better Auth's `verifications` table (identifier `stripe-app-login:<state>`, 15-min TTL).
- **Backend pieces:** `src/lib/stripe-app-session.ts`, routes `/api/stripe-app/{session,verify,userinfo}`, `sendResetPassword` in `src/lib/auth.ts` (prints the reset link to the terminal — no email provider wired up), and a `(login)` route group sharing one card layout + `components.tsx` + `redirect.ts`.
- **App pieces:** `stripe-app/src/components/Login.tsx` (state machine, 5s polling), helpers in `src/api/backend.ts`, wired into `App.tsx` as demo section 3.
- **Verified 2026-07-20** end-to-end against Supabase project `xcqewnpyuzknxjnximju`, schema `example`.
- **Machine quirk:** this PC had stale *user-scope* Windows env vars (`NEXT_PUBLIC_SUPABASE_URL`, …) overriding `.env.local` (process env beats env files in Next.js). Deleted 2026-08-04; `.claude/launch.json` (gitignored) still clears them defensively.

## Suggested next session tasks

1. Do the maintainer steps in the "Stripe Projects conversion" section (split `stripe-app/` into its own repo + submodule, push, pin `ref`, real `stripe projects build` test, registry PR). Confirm whether Supabase emits `SUPABASE_SECRET_KEY` and simplify the docs accordingly.
2. Remaining Stripe App UI example: an API-key Settings view using `stripe.apps.secrets` (model on rtk-mobile `Settings.tsx`).
3. Future work: user API keys table in `setup.sql` (hashed keys) + DB lookup in `verifyApiKey()` — remember to ship matching `ALTER TABLE`/`CREATE TABLE` SQL for existing databases.
4. Optional: named Stripe Projects environments (`stripe projects env create production --output .env.production`) for a separate production Supabase project; `npm run deploy` would need an `--env-file` flag to read it.

-- setup.sql — creates every table the backend expects.
-- This file is the single source of truth for the database schema.
--
-- Run it once against your Supabase project, either way:
--   • paste it into the Supabase SQL editor (Dashboard → SQL Editor → Run), or
--   • npm run db:setup   (applies it over DATABASE_URL from .env.local)
--
-- Tables land in the `public` schema. To share a Supabase project you already
-- use for something else, set SUPABASE_SCHEMA in .env.local and run
-- `npm run db:setup` instead — it creates the dedicated schema, installs
-- everything there, and grants the Supabase API roles access
-- (`npm run db:setup -- --print` prints that schema-qualified SQL if you
-- prefer the SQL editor). Then add the schema to "Exposed schemas" in the
-- Supabase dashboard (Settings → API).
--
-- To change the schema later: edit the CREATE TABLE statements here (for
-- fresh installs) and run matching ALTER TABLE statements against any
-- database that already holds data.
--
-- The shape, in three parts:
--
--   Better Auth      users, sessions, auth_accounts, verifications.
--                    auth_accounts is a sign-in method (credential or OAuth
--                    provider) — Better Auth's "account" model, unrelated to
--                    Stripe accounts. `users` also carries app-owned columns
--                    (settings, billing customer ids); Better Auth ignores
--                    columns it doesn't know about.
--
--   Merchant side    stripe_accounts (one row per acct_… id the app is
--                    installed into) and memberships (the user ↔ Stripe
--                    account many-to-many, carrying the user's role and
--                    per-company settings).
--
--   App login        stripe_app_sessions — which app user is logged in
--                    inside the Stripe Dashboard. (The short-lived login
--                    handshakes ride on the verifications table.)
--
--   Publisher side   subscriptions — each app user's subscription in the
--                    app publisher's own Stripe account. The matching
--                    Customer ids live on `users`.
--
-- Two conventions worth noticing:
--
--   Natural keys     Stripe ids are unique and immutable, so Stripe-owned
--                    rows use them as primary keys directly (acct_… for
--                    stripe_accounts, sub_… for subscriptions). No surrogate
--                    uuid + separate unique column carrying the same fact.
--
--   livemode         Kept only where Stripe itself splits data by mode:
--                    billing customers (two columns on users) and
--                    subscriptions (a livemode column). App-owned data —
--                    roles, settings — is mode-independent; if an account
--                    needs mode-split settings, nest them inside the jsonb
--                    ({"live": …, "test": …}) instead of forking the schema.

-- ============================================================================
--  Better Auth (managed by Better Auth over DATABASE_URL; mapped in
--  src/lib/auth.ts)
-- ============================================================================

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text,
	"image" text,
	-- App-owned columns (written via supabase-js, not Better Auth):
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	-- The user as a Customer in the app publisher's Stripe billing account,
	-- one id per mode. NULL until first checkout in that mode.
	"stripe_customer_id_live" text,
	"stripe_customer_id_test" text,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_stripe_customer_id_live_unique" UNIQUE("stripe_customer_id_live"),
	CONSTRAINT "users_stripe_customer_id_test_unique" UNIQUE("stripe_customer_id_test")
);

CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"token" text NOT NULL,
	"expires_at" timestamptz NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
CREATE INDEX "sessions_user_id_idx" ON "sessions" ("user_id");

-- A sign-in method (email/password credential or OAuth provider link).
CREATE TABLE "auth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamptz,
	"refresh_token_expires_at" timestamptz,
	"scope" text,
	"password" text,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "auth_accounts_user_id_idx" ON "auth_accounts" ("user_id");

CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamptz NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "verifications_identifier_idx" ON "verifications" ("identifier");

-- ============================================================================
--  Merchant side — the Stripe accounts the app is installed into
-- ============================================================================

-- One row per Stripe account (the acct_… id is the primary key). Install
-- state is two nullable columns: NULL means "not installed in that mode",
-- non-NULL holds the installation id. A general sandbox has its own acct_…
-- id, so it's simply another row here (installs land in the test column).
CREATE TABLE "stripe_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	-- Settings shared by every member of the account (e.g. the company
	-- office address).
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"live_installation_id" text,
	"test_installation_id" text,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);

-- The user ↔ Stripe account many-to-many. Data about the *relationship*
-- lives here: the user's role in that company, and their settings within it
-- (e.g. which address is their local office).
CREATE TABLE "memberships" (
	"stripe_account_id" text NOT NULL REFERENCES "stripe_accounts"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"role" text DEFAULT 'member' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_pkey" PRIMARY KEY ("stripe_account_id", "user_id"),
	CONSTRAINT "memberships_role_check" CHECK ("role" IN ('owner', 'admin', 'member'))
);
CREATE INDEX "memberships_user_id_idx" ON "memberships" ("user_id");

-- ============================================================================
--  Stripe App login — who is logged in inside the Stripe Dashboard
--  (the /api/stripe-app/session|verify|userinfo routes; see AUTHENTICATION.md)
-- ============================================================================

-- (The other half of the login flow — the short-lived state handshake the
-- app polls while the user logs in in a browser tab — needs no table of its
-- own: it's stored as rows in "verifications" above, identifier
-- 'stripe-app-login:<state>'. See src/lib/stripe-app-session.ts.)

-- The persistent "logged in inside Stripe" link: one row per dashboard user
-- (usr_…) per Stripe account. stripe_user_id is '' when the caller has no
-- dashboard user id (Connect/platform contexts). Distinct from memberships —
-- a membership says the user belongs to the account; this row says the app's
-- UI extension currently has them logged in. Deleted on app logout.
CREATE TABLE "stripe_app_sessions" (
	"stripe_account_id" text NOT NULL,
	"stripe_user_id" text DEFAULT '' NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_app_sessions_pkey" PRIMARY KEY ("stripe_account_id", "stripe_user_id")
);
CREATE INDEX "stripe_app_sessions_user_id_idx" ON "stripe_app_sessions" ("user_id");

-- ============================================================================
--  Publisher side — charging app users for the app itself
-- ============================================================================

-- Subscription state synced from the publisher billing account's webhooks.
-- The sub_… id is the primary key; livemode stays because live and test
-- subscriptions are genuinely different Stripe objects.
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"stripe_customer_id" text NOT NULL,
	"livemode" boolean NOT NULL,
	"status" text NOT NULL,
	"price_id" text,
	"quantity" integer,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"current_period_start" timestamptz,
	"current_period_end" timestamptz,
	"ended_at" timestamptz,
	"cancel_at" timestamptz,
	"canceled_at" timestamptz,
	"trial_start" timestamptz,
	"trial_end" timestamptz,
	"metadata" jsonb,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" ("user_id");

-- ============================================================================
--  Row Level Security
-- ============================================================================

-- Supabase exposes the public schema through its auto-generated REST API.
-- Enabling Row Level Security with no policies locks every table down for the
-- public anon key. The backend is unaffected: it uses the service-role key
-- (which bypasses RLS), and Better Auth connects directly over DATABASE_URL.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stripe_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stripe_app_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;

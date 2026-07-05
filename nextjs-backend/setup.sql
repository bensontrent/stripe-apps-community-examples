-- setup.sql — creates every table the backend expects.
-- Paste into the Supabase SQL editor (or run: psql "$DATABASE_URL" -f setup.sql)
-- as an alternative to `npm run db:push`.
--
-- GENERATED FILE — do not edit by hand.
-- Regenerate after any change to src/db/schema.ts by running: npm run db:generate
-- (drizzle-kit writes a migration, then this file is rebuilt from all migrations)

CREATE TABLE "auth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "billing_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"livemode" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_customers_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "billing_customers_user_mode_unique" UNIQUE("user_id","livemode")
);

CREATE TABLE "billing_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"livemode" boolean NOT NULL,
	"status" text NOT NULL,
	"price_id" text,
	"quantity" integer,
	"cancel_at_period_end" boolean DEFAULT false,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"ended_at" timestamp,
	"cancel_at" timestamp,
	"canceled_at" timestamp,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);

CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);

CREATE TABLE "stripe_account_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_account_id" text NOT NULL,
	"livemode" boolean NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_account_settings_account_mode_unique" UNIQUE("stripe_account_id","livemode")
);

CREATE TABLE "stripe_account_user_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_account_id" text NOT NULL,
	"livemode" boolean NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_account_user_settings_user_account_mode_unique" UNIQUE("user_id","stripe_account_id","livemode")
);

CREATE TABLE "stripe_account_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_account_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_account_users_user_account_unique" UNIQUE("user_id","stripe_account_id")
);

CREATE TABLE "stripe_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_account_id" text NOT NULL,
	"name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_accounts_stripe_account_id_unique" UNIQUE("stripe_account_id")
);

CREATE TABLE "stripe_app_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_account_id" text NOT NULL,
	"livemode" boolean NOT NULL,
	"installation_id" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_app_installations_account_mode_unique" UNIQUE("stripe_account_id","livemode")
);

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false,
	"name" text,
	"image" text,
	"settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "stripe_account_settings" ADD CONSTRAINT "stripe_account_settings_stripe_account_id_stripe_accounts_stripe_account_id_fk" FOREIGN KEY ("stripe_account_id") REFERENCES "public"."stripe_accounts"("stripe_account_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "stripe_account_user_settings" ADD CONSTRAINT "stripe_account_user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "stripe_account_user_settings" ADD CONSTRAINT "stripe_account_user_settings_stripe_account_id_stripe_accounts_stripe_account_id_fk" FOREIGN KEY ("stripe_account_id") REFERENCES "public"."stripe_accounts"("stripe_account_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "stripe_account_users" ADD CONSTRAINT "stripe_account_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "stripe_account_users" ADD CONSTRAINT "stripe_account_users_stripe_account_id_stripe_accounts_stripe_account_id_fk" FOREIGN KEY ("stripe_account_id") REFERENCES "public"."stripe_accounts"("stripe_account_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "stripe_app_installations" ADD CONSTRAINT "stripe_app_installations_stripe_account_id_stripe_accounts_stripe_account_id_fk" FOREIGN KEY ("stripe_account_id") REFERENCES "public"."stripe_accounts"("stripe_account_id") ON DELETE cascade ON UPDATE no action;

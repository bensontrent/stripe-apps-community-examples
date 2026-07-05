// Environment variables type definitions
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Database
      DATABASE_URL: string;

      // Supabase
      NEXT_PUBLIC_SUPABASE_URL: string;
      NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
      SUPABASE_SERVICE_ROLE_KEY: string;

      // Better Auth
      BETTER_AUTH_SECRET: string;
      BETTER_AUTH_URL: string;
      NEXT_PUBLIC_BETTER_AUTH_URL?: string;

      // Stripe API keys & webhook secrets (see src/lib/stripe.ts)
      STRIPE_APP_SECRET_KEY_LIVE: string;
      STRIPE_APP_SECRET_KEY_TEST: string;
      STRIPE_APP_SECRET_KEY_MANAGED_SANDBOX: string;
      STRIPE_APP_WEBHOOK_SECRET_LIVE_CONNECTED: string;
      STRIPE_APP_WEBHOOK_SECRET_TEST_CONNECTED: string;
      STRIPE_APP_WEBHOOK_SECRET_MANAGED_SANDBOX_CONNECTED: string;
      STRIPE_APP_WEBHOOK_SECRET_LIVE_ACCOUNT?: string;
      STRIPE_APP_WEBHOOK_SECRET_TEST_ACCOUNT?: string;
      STRIPE_BILLING_SECRET_KEY_LIVE?: string;
      STRIPE_BILLING_SECRET_KEY_TEST?: string;
      STRIPE_BILLING_WEBHOOK_SECRET_LIVE?: string;
      STRIPE_BILLING_WEBHOOK_SECRET_TEST?: string;

      // Proxy authentication (src/proxy.ts + src/lib/proxy-auth.ts)
      /** Stripe App signing secret — verifies `stripe-signature` headers. */
      STRIPE_APP_SECRET: string;
      /** Comma-separated bearer keys for `Authorization: Bearer <key>`. */
      BEARER_TOKEN_KEYS?: string;
      /** Accepted as a bearer key; Vercel sends it for cron invocations. */
      CRON_SECRET?: string;
      /** Bearer key accepted ONLY when NODE_ENV=development. */
      DEV_API_KEY?: string;
      /** Signs short-lived JWT-in-URL tokens (src/lib/url-token.ts). */
      URL_TOKEN_SECRET: string;

      // App
      NODE_ENV: 'development' | 'production' | 'test';
    }
  }
}

export {};

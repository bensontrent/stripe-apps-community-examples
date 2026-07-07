import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { dbSchema } from './supabase';

// Better Auth manages its own tables (users, sessions, auth_accounts,
// verifications) and needs a direct Postgres connection to do it — Supabase
// is just Postgres, so a plain `pg` Pool on DATABASE_URL is all it takes.
// The tables themselves are created by setup.sql.
//
// The modelName/fields blocks map Better Auth's default camelCase names onto
// the snake_case tables in setup.sql. Everything else in the app talks to
// the database through the Supabase client (src/lib/supabase.ts).
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// When SUPABASE_SCHEMA points at a dedicated schema, aim every connection's
// search_path there so Better Auth finds its tables. (dbSchema is validated
// as a plain identifier in src/lib/supabase.ts. Use the Session pooler
// connection string — the transaction pooler doesn't keep per-connection
// settings like search_path.)
if (dbSchema !== 'public') {
  pool.on('connect', (client) => {
    void client.query(`set search_path to "${dbSchema}"`);
  });
}

export const auth = betterAuth({
  database: pool,
  user: {
    modelName: 'users',
    fields: {
      emailVerified: 'email_verified',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  session: {
    modelName: 'sessions',
    fields: {
      userId: 'user_id',
      expiresAt: 'expires_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  // Better Auth's "account" model is a sign-in method (credential or OAuth
  // provider), stored in auth_accounts. It is unrelated to Stripe accounts.
  account: {
    modelName: 'auth_accounts',
    fields: {
      userId: 'user_id',
      accountId: 'account_id',
      providerId: 'provider_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      idToken: 'id_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  verification: {
    modelName: 'verifications',
    fields: {
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: {},
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    }
  },
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
});

export type Auth = typeof auth;

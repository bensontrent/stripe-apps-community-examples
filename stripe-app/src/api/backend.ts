// src/api/backend.ts
//
// ============================================================================
//  Signed-fetch client — how this Stripe App talks to the Next.js backend
// ============================================================================
//
// Every request carries a `stripe-signature` header from
// fetchStripeSignature(). The backend proxy (nextjs-backend/src/proxy.ts)
// verifies that HMAC against the app's signing secret (STRIPE_APP_SECRET),
// which proves the request really came from this app running in the Stripe
// Dashboard — no login, cookies, or API keys needed.
//
// The signature covers { user_id, account_id }, so the backend can also
// trust the stripe-user-id / stripe-account-id headers we send.
//
// NOTE: the backend URL must also be listed in the `connect-src`
// content_security_policy of stripe-app.json, or fetch() will be blocked.
// ============================================================================

import type { ExtensionContextValue } from '@stripe/ui-extension-sdk/context';
import { fetchStripeSignature } from '@stripe/ui-extension-sdk/utils';

// Point this at your deployed backend. `stripe apps start` allows
// http://localhost for development; published apps must use https.
export const BACKEND_BASE = 'http://localhost:3006';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * Error with a setup hint attached. A signed request can fail in three
 * distinct phases — getting the signature from Stripe, reaching the
 * backend, and the backend rejecting the request — and each one has a
 * different fix. The `hint` says which fix applies so the UI doesn't have
 * to guess.
 */
export class BackendConnectionError extends Error {
  constructor(
    message: string,
    readonly hint: string,
    /** HTTP status when the backend answered with an error, else undefined. */
    readonly status?: number,
  ) {
    super(message);
    this.name = 'BackendConnectionError';
  }
}

function signatureHint(detail: string): string {
  if (detail.includes('No such app')) {
    return (
      'Stripe can only sign requests for apps that have been uploaded. ' +
      'Run `stripe apps upload` once from stripe-app/ (pick your own app id ' +
      'in stripe-app.json first — see the root README), copy the signing ' +
      'secret into nextjs-backend/.env.local as STRIPE_APP_SECRET, then ' +
      'restart `stripe apps start`. Uploading does NOT publish the app.'
    );
  }
  return (
    'fetchStripeSignature() failed inside the dashboard preview. ' +
    'Make sure you are running the app via `stripe apps start` and are ' +
    'logged in with `stripe login`.'
  );
}

function statusHint(status: number): string {
  switch (status) {
    case 401:
    case 403:
      return (
        'The backend rejected the signature. Usually STRIPE_APP_SECRET in ' +
        'nextjs-backend/.env.local is missing or does not match this app — ' +
        'copy the signing secret from your app’s settings page in the ' +
        'Stripe Developers Dashboard (it exists after `stripe apps upload`).'
      );
    case 500:
      return (
        'The backend errored. Check the `npm run dev` terminal for the ' +
        'stack trace — a missing env var (e.g. URL_TOKEN_SECRET) is the ' +
        'usual cause. Compare .env.local against .env.example.'
      );
    default:
      return 'Check the backend terminal logs for details.';
  }
}

/**
 * fetch() with the headers the backend proxy expects:
 *   stripe-signature   — HMAC proving the request came from this app
 *   stripe-user-id     — the dashboard user (covered by the signature)
 *   stripe-account-id  — the Stripe account (covered by the signature)
 *   stripe-mode        — 'live' | 'test', so the backend picks the right keys
 *
 * Throws BackendConnectionError with a phase-specific setup hint.
 */
async function signedFetch<T>(
  method: Method,
  path: string,
  context: ExtensionContextValue,
  body?: unknown,
): Promise<T> {
  // Phase 1: ask Stripe for the signature. Fails before the backend is
  // ever contacted — most commonly with "No such app: <id>" when the app
  // hasn't been uploaded yet.
  let signature: string;
  try {
    signature = await fetchStripeSignature();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new BackendConnectionError(
      `Couldn't get a Stripe signature: ${detail}`,
      signatureHint(detail),
    );
  }

  // Phase 2: reach the backend at all.
  let response: Response;
  try {
    response = await fetch(`${BACKEND_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': signature,
        'stripe-user-id': context.userContext?.id ?? '',
        'stripe-account-id': context.userContext?.account.id ?? '',
        'stripe-mode': context.environment.mode,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new BackendConnectionError(
      `Couldn't reach the backend at ${BACKEND_BASE}: ${detail}`,
      'Is the backend running? Start it with `npm run dev` in ' +
      'nextjs-backend. For a deployed backend, its URL must also be ' +
      'listed in connect-src in stripe-app.json.',
    );
  }

  // Phase 3: the backend answered but said no.
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new BackendConnectionError(
      `Backend responded ${response.status} ${response.statusText}: ${detail}`,
      statusHint(response.status),
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
//  Example calls, one per backend auth flavor
// ---------------------------------------------------------------------------

export type MeResponse = {
  accountId: string | null;
  userId: string | null;
  mode: string | null;
  authType: string | null;
  message: string;
};

/**
 * Stripe-signature auth: the simplest round trip. The backend proxy
 * verifies our signature and the route echoes back who we are.
 */
export function getMe(context: ExtensionContextValue): Promise<MeResponse> {
  return signedFetch<MeResponse>('GET', '/api/stripe-app/me', context);
}

export type UrlTokenResponse = {
  token: string;
  expiresIn: string;
  /** Ready-to-open link with ?token=...&account=... already appended. */
  url: string;
};

/**
 * JWT-in-URL auth: exchange this signed request for a short-lived link to
 * a public route. Hand `url` to the browser (new tab, download link) —
 * it authenticates itself via the token in its query string.
 */
export function createDownloadLink(
  context: ExtensionContextValue,
): Promise<UrlTokenResponse> {
  return signedFetch<UrlTokenResponse>('POST', '/api/stripe-app/token', context, {
    path: '/api/public/download',
  });
}

// ---------------------------------------------------------------------------
//  User login (see src/components/Login.tsx and the backend's
//  src/lib/stripe-app-session.ts for the full handshake)
// ---------------------------------------------------------------------------

export type UserInfoResponse = {
  userId: string;
  email: string;
  name: string | null;
  accountId: string;
};

/**
 * Who is logged in inside the dashboard for this account/user, or null when
 * nobody is (the backend answers 401 in that case).
 */
export async function getUserInfo(
  context: ExtensionContextValue,
): Promise<UserInfoResponse | null> {
  try {
    return await signedFetch<UserInfoResponse>(
      'GET',
      '/api/stripe-app/userinfo',
      context,
    );
  } catch (error) {
    if (error instanceof BackendConnectionError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

/**
 * One poll of the login handshake: true once the user has finished logging
 * in in the browser tab (the backend links them and answers 200), false
 * while the handshake is still pending (404).
 */
export async function verifyLoginState(
  context: ExtensionContextValue,
  state: string,
): Promise<boolean> {
  try {
    await signedFetch(
      'GET',
      `/api/stripe-app/verify?${new URLSearchParams({ state })}`,
      context,
    );
    return true;
  } catch (error) {
    if (error instanceof BackendConnectionError && error.status === 404) {
      return false;
    }
    throw error;
  }
}

/** Log out: the backend forgets this dashboard identity's link. */
export function deleteAppSession(
  context: ExtensionContextValue,
): Promise<{ message: string }> {
  return signedFetch<{ message: string }>(
    'DELETE',
    '/api/stripe-app/session',
    context,
  );
}

/** Browser URL the app opens for the user to log in (state = handshake key). */
export function loginPageUrl(state: string): string {
  return `${BACKEND_BASE}/stripe?${new URLSearchParams({ state })}`;
}

/** Browser URL that ends the user's browser session. */
export function logoutPageUrl(): string {
  return `${BACKEND_BASE}/stripe-logout`;
}

// Bearer-token auth from a Stripe App: store a user-provided key with
// `stripe.apps.secrets.create({ scope: { type: 'account' }, name, payload })`,
// read it back with `stripe.apps.secrets.find(...)`, and send it as an
// `Authorization: Bearer <key>` header alongside the signed headers above.
// See the Settings view pattern in the Stripe Apps docs ("Store secrets").

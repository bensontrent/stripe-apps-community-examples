// lib/url-token.ts
//
// ============================================================================
//  Short-lived JWTs passed in URL query parameters
// ============================================================================
//
// Some links can't carry headers or cookies — a "download my label PDF"
// link opened in a new tab, an <img src>, a link shared into another app.
// For those we mint a short-lived JWT, put it in the URL, and verify it at
// the ROUTE level (the proxy treats these routes as public).
//
// Flow:
//   1. An already-authenticated caller (e.g. a Stripe App via a signed
//      request) POSTs to /api/stripe-app/token and receives a token bound
//      to its Stripe account id and one path.
//   2. The caller opens `<path>?token=<jwt>&account=<acct_...>`.
//   3. The route handler calls verifyUrlToken(), which checks the
//      signature, the expiry, the path binding, and that the account in
//      the query matches the account baked into the token.
//
// Tokens are signed with URL_TOKEN_SECRET (HS256). Keep expiries short —
// URLs end up in logs, browser history, and referrer headers.
// ============================================================================

import { jwtVerify, SignJWT } from 'jose';

export type UrlTokenPayload = {
  /** The Stripe account the token was minted for. */
  accountId: string;
  /** The path this token is allowed to access. */
  path: string;
};

/**
 * Paths that may be accessed with a URL token at all. A token whose `path`
 * claim isn't under one of these prefixes is rejected even if its
 * signature is valid — so a leaked signing secret still can't open up
 * arbitrary routes.
 */
export const URL_TOKEN_ALLOWED_PATHS = ['/api/public/download'];

const encoder = new TextEncoder();

function signingSecret(): Uint8Array {
  const secret = process.env.URL_TOKEN_SECRET;
  if (!secret) {
    throw new Error('URL_TOKEN_SECRET is not configured');
  }
  return encoder.encode(secret);
}

/**
 * Mint a short-lived token for one account + path.
 *
 * @param expiresIn jose time span, e.g. '15m', '1h'. Keep it short.
 */
export async function signUrlToken(
  payload: UrlTokenPayload,
  expiresIn = '15m',
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(signingSecret());
}

/**
 * Verify a URL token at the route level. Throws with a descriptive
 * message when anything is off; returns the decoded payload on success.
 *
 * @param token          the `token` query parameter
 * @param requestPath    the pathname actually being requested
 * @param queryAccountId the `account` query parameter (must match the token)
 */
export async function verifyUrlToken(
  token: string,
  requestPath: string,
  queryAccountId: string,
): Promise<UrlTokenPayload> {
  let payload: UrlTokenPayload;
  try {
    const verified = await jwtVerify<UrlTokenPayload>(token, signingSecret());
    payload = verified.payload;
  } catch {
    throw new Error('Invalid or expired session token');
  }

  if (!payload.path || !payload.accountId) {
    throw new Error('Malformed session token');
  }

  const isAllowedPath = URL_TOKEN_ALLOWED_PATHS.some((allowed) =>
    requestPath.startsWith(allowed),
  );
  if (!isAllowedPath || !requestPath.startsWith(payload.path)) {
    throw new Error('Token is not valid for this path');
  }

  if (payload.accountId !== queryAccountId) {
    throw new Error('Token is not valid for this account');
  }

  return payload;
}

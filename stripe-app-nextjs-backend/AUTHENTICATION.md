# Authentication

Every request to this backend passes through the Next.js proxy
([`src/proxy.ts`](src/proxy.ts)) before reaching a page or route handler.
The proxy sorts requests into **auth flavors** — verification helpers live in
[`src/lib/proxy-auth.ts`](src/lib/proxy-auth.ts).

## The flavors at a glance

| Flavor | How the caller authenticates | Verified | Example route |
| --- | --- | --- | --- |
| Public + webhook signature | `stripe-signature` header (webhook scheme) | At the route | [`/api/stripe/webhook`](src/app/api/stripe/webhook/route.ts) |
| Public + JWT in URL | `?token=<jwt>&account=<acct_...>` query params | At the route | [`/api/public/download`](src/app/api/public/download/route.ts) |
| Stripe App signature | `stripe-signature` header from `fetchStripeSignature()` | In the proxy | [`/api/stripe-app/me`](src/app/api/stripe-app/me/route.ts) |
| Bearer token | `Authorization: Bearer <key>` vs `BEARER_TOKEN_KEYS` / `CRON_SECRET` | In the proxy | [`/api/cron`](src/app/api/cron/route.ts) |
| Local dev API key | `Authorization: Bearer $DEV_API_KEY`, **`next dev` only** | In the proxy | any bearer route |
| User API keys | Bearer keys checked against the database | Future work | — |
| Better Auth session | `better-auth.session_token` cookie | Cookie check in proxy, real check at the route | [`/api/protected/stripe-app`](src/app/api/protected/stripe-app/route.ts) |

After verification the proxy forwards the request with `x-auth-type` set to
the flavor that matched (`stripe-signature`, `bearer-token`, `dev-api-key`,
`session`, ...) and, for Stripe App requests, `x-stripe-verified: true`.
The proxy **strips those headers from every incoming request first**, so
route handlers can trust them.

## 1. Public routes (route-level auth)

Routes listed in `PUBLIC_ROUTES` in `src/proxy.ts` bypass the proxy checks
entirely. They are either genuinely public or verify credentials themselves:

- **Stripe webhooks** — `/api/stripe/webhook` verifies the webhook signature
  with `stripe.webhooks.constructEvent()` inside the handler.
- **JWT in the URL** — `/api/public/*` routes verify a short-lived token from
  the query string with [`src/lib/url-token.ts`](src/lib/url-token.ts).
  Useful for links that can't carry headers or cookies (downloads opened in
  a new tab, `<img src>`, links shared to other apps). Tokens are bound to
  one Stripe account and one path, and expire in minutes.
- **Better Auth's own endpoints** — `/api/auth/*` handle their own cookies
  and CSRF.

The JWT-in-URL flow end to end:

1. The Stripe App makes a *signed* `POST /api/stripe-app/token` (flavor 2)
   and gets back `{ token, url }` bound to its account id.
2. The browser opens `/api/public/download?token=...&account=acct_...`.
3. The route handler calls `verifyUrlToken()`, which checks the signature,
   expiry, the path binding, and that `account` matches the token.

## 2. Stripe App signature auth

The Stripe App UI extension calls `fetchStripeSignature()` and sends:

```
stripe-signature:  t=...,v1=...           (HMAC from Stripe)
stripe-user-id:    usr_...                (covered by the signature)
stripe-account-id: acct_...               (covered by the signature)
stripe-mode:       live | test
```

The proxy rebuilds the signed payload from those headers and verifies the
HMAC against **`STRIPE_APP_SECRET`** — the "Signing secret" from your app's
settings page in the Stripe Developers Dashboard. Tampering with the id
headers breaks the signature, so route handlers can trust them.

### Getting the signing secret (you must upload the app first)

The signing secret **does not exist until you upload the app** — a locally
previewed app (`stripe apps start`) has no secret yet. In fact,
`fetchStripeSignature()` itself fails with **`No such app: <your-app-id>`**
until the app has been uploaded once, so the signed-request demo can't run
at all before that. Run:

```bash
cd stripe-app
stripe apps upload
```

then open your app's settings page in the Stripe Developers Dashboard
(Dashboard → Developers → Apps → your app) and copy the **Signing secret**
into `STRIPE_APP_SECRET` in the backend's `.env.local`.

**Don't hesitate to upload — uploading is not publishing.** An uploaded app
is visible only to your own Stripe account, even if `stripe-app.json`
declares a "public" distribution type. "Public" there is a misnomer:
actually making an app public is a separate, much longer process — after
uploading you still have to submit the app for review, pass Stripe's review,
and build out a Stripe App Marketplace listing before anyone else can see or
install it. Treat `stripe apps upload` as a private development step you can
run as often as you like.

The client side of this lives in
[`stripe-app/src/api/backend.ts`](../stripe-app/src/api/backend.ts). Note
the backend URL must be listed in `connect-src` in
[`stripe-app.json`](../stripe-app/stripe-app.json).

## 3–5. Bearer tokens, the dev key, and user API keys

Any non-public request with `Authorization: Bearer <key>` is checked
against, in order (`verifyApiKey()` in `src/lib/proxy-auth.ts`):

1. **`BEARER_TOKEN_KEYS`** — comma-separated static keys — and
   **`CRON_SECRET`** (Vercel sends it automatically for cron jobs).
2. **`DEV_API_KEY`** — accepted **only when `NODE_ENV=development`**, so a
   leaked dev key is useless in production:

   ```bash
   curl http://localhost:3006/api/stripe-app/me \
     -H "Authorization: Bearer $DEV_API_KEY"
   ```

3. **User API keys** *(future work)* — per-user keys stored hashed in the
   database. The lookup slot is stubbed with a TODO in `verifyApiKey()`.

Routes in `BEARER_ONLY_ROUTES` (e.g. `/api/cron`) *require* a bearer key —
there is no session fallback.

## 6. Better Auth sessions (browser traffic)

Everything else falls back to the Better Auth session cookie:

- **Pages** without a session redirect to `/login?redirect=<path>`.
- **API routes** without a session get a `401` JSON response.

The proxy only does an optimistic cookie check (cheap, no DB hit). Route
handlers do the real verification with `auth.api.getSession()` — see
[`/api/protected/stripe-app`](src/app/api/protected/stripe-app/route.ts).

The browser-facing pages live in the [`(login)` route group](src/app/(login)):
`/login`, `/register`, `/reset-password`, and `/confirm` (the password-reset
landing page — in this example the reset link is printed to the backend
terminal; wire a real email service into `sendResetPassword` in
`src/lib/auth.ts`). `/end-session` is a generic sign-out landing page.

## The Stripe App user login flow

A Stripe App UI extension can't set cookies or render its own login form, so
"logging in" combines two flavors above — **signature auth** (the app) and
**session auth** (the browser) — in a handshake:

1. The app's [`Login` component](../stripe-app/src/components/Login.tsx)
   mints a random `state` key and opens `/stripe?state=…` in a browser tab.
2. The user signs in there like any browser visitor (the proxy bounces them
   through `/login` or `/register` and back, query string intact). The
   [`/stripe` page](src/app/(login)/stripe/page.tsx) then POSTs the state to
   `/api/stripe-app/session` (session auth), storing state → user for 15
   minutes (as a `verifications` row — no extra table).
3. Meanwhile the app polls `GET /api/stripe-app/verify?state=…` (signature
   auth). Once the state exists, the backend links the **signed** dashboard
   identity (`stripe-account-id` + `stripe-user-id`) to that user in
   `stripe_app_sessions`, upserts a `memberships` row, and consumes the
   state (one-shot).
4. From then on `GET /api/stripe-app/userinfo` (signature auth) resolves the
   dashboard user to the app user on every request — no cookies involved.
   "Log out" is `DELETE /api/stripe-app/session` (signature auth) plus the
   `/stripe-logout` page, which ends the browser session.

The server-side halves live in
[`src/lib/stripe-app-session.ts`](src/lib/stripe-app-session.ts); the
app-side halves in
[`stripe-app/src/api/backend.ts`](../stripe-app/src/api/backend.ts).

## Environment variables

See [`.env.example`](.env.example) — the "Proxy authentication" section has
one variable per flavor: `STRIPE_APP_SECRET`, `BEARER_TOKEN_KEYS`,
`CRON_SECRET`, `DEV_API_KEY`, `URL_TOKEN_SECRET`.

## Adding a new route

1. Decide the flavor. Session-protected API routes need no proxy changes.
2. Public / route-level auth → add the prefix to `PUBLIC_ROUTES` and verify
   inside the handler.
3. Key-only machine endpoints → add the prefix to `BEARER_ONLY_ROUTES`.
4. In the handler, read `x-auth-type` (via `AUTH_HEADERS.authType`) when you
   need to know *how* the caller authenticated.

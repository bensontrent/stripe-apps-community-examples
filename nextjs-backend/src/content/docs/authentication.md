---
title: Authentication
description: How the proxy sorts every request into an auth flavor before your route code runs.
order: 2
---

Every request passes through `src/proxy.ts` (Next.js 16 calls this the
"proxy"; it was `middleware.ts` in earlier versions) before any route
handler or page. It is the single place where requests are sorted into auth
flavors:

| Flavor | Trigger | Verified by |
| ------ | ------- | ----------- |
| Public | Path in `PUBLIC_ROUTES` / `PUBLIC_PAGES` | The route itself (see below) |
| Stripe App | `stripe-signature` + `stripe-account-id` headers | HMAC check in the proxy |
| API key | `Authorization: Bearer <key>` | `BEARER_TOKEN_KEYS`, `CRON_SECRET`, or `DEV_API_KEY` |
| Session | `better-auth.session_token` cookie | Optimistic in the proxy, fully in the route |

## Public routes

Paths listed in `PUBLIC_ROUTES` bypass proxy authentication entirely. Each
one is either genuinely public (like these docs at `/docs`) or authenticates
**at the route level**:

- `/api/stripe/webhook` — verifies the Stripe webhook signature
- `/api/public/*` — verifies a short-lived JWT passed in the URL query
- `/api/auth/*` — Better Auth handles its own cookies and CSRF

## Stripe App signed requests

Requests from your app's UI extension carry `stripe-signature` and
`stripe-account-id` headers. The proxy verifies the HMAC against
`STRIPE_APP_SECRET`; on success the `stripe-*` identity headers are
trustworthy because they are exactly what was signed.

## API keys

Server-to-server callers send a bearer token:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3006/api/cron
```

Routes in `BEARER_ONLY_ROUTES` (like `/api/cron`) never fall back to a
session — a missing or invalid key is a hard 401.

{% callout type="info" title="DEV_API_KEY" %}
When `NODE_ENV=development`, the proxy also accepts `DEV_API_KEY` as a
bearer key — handy for local curl testing without minting real keys.
{% /callout %}

## Browser sessions

Everything else falls through to the Better Auth session cookie. The proxy
does an **optimistic** cookie check only (cheap, good enough for routing):
pages without a cookie redirect to `/login`, API routes get a 401. Route
handlers do the real verification with `auth.api.getSession()`.

{% callout type="warning" title="Trusting the proxy's markers" %}
The proxy stamps verified requests with `x-auth-type` (and
`x-stripe-verified` for Stripe App requests). These headers are stripped
from every **incoming** request before any branch runs, so a client can
never spoof them — route handlers can trust them. See
`src/lib/proxy-auth.ts` for the helpers.
{% /callout %}

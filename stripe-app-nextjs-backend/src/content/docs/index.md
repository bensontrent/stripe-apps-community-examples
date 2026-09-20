---
title: Overview
description: A companion backend for Stripe Apps — authentication, webhooks, and user accounts for your app's UI extension.
order: 0
---

This site documents the **Next.js backend** from the Stripe Apps community
examples: a ready-to-fork backend that gives your Stripe App a place to store
data, verify signed requests from your UI extension, receive webhooks, and
manage end-user accounts.

{% callout title="This docs site is part of the sample" %}
These pages are rendered with [Markdoc](https://markdoc.dev) from plain
`.md` files in `src/content/docs`. Fork the pattern to document your own
app — see [Writing docs](/docs/writing-docs) for how.
{% /callout %}

## What's included

- **Authentication proxy** — every request is sorted into an auth flavor
  (public, Stripe App signature, API key, or browser session) in one place:
  `src/proxy.ts`. See [Authentication](/docs/authentication).
- **Stripe App request verification** — requests from your UI extension carry
  a `stripe-signature` header; the proxy verifies the HMAC before your route
  code runs.
- **Webhooks and cron** — a signature-verified Stripe webhook endpoint and a
  bearer-protected cron route. See [Stripe webhooks](/docs/stripe-webhooks).
- **User accounts** — email/password auth via
  [Better Auth](https://better-auth.com), backed by Postgres
  ([Supabase](https://supabase.com)).
- **This documentation system** — public Markdoc-powered docs at `/docs`.

## Where things live

| Path | What it is |
| ---- | ---------- |
| `src/proxy.ts` | The authentication proxy (Next.js 16 "proxy", formerly middleware) |
| `src/app/api/*` | Route handlers (webhooks, cron, Stripe App endpoints) |
| `src/lib/*` | Stripe, Supabase, and Better Auth clients + proxy helpers |
| `src/content/docs/*` | These documentation pages (Markdoc) |
| `src/services/markdoc/*` | Markdoc config, components, and content loader |

## Next steps

Start with [Getting started](/docs/getting-started) to run the backend
locally, then read [Authentication](/docs/authentication) to understand how
requests reach your route handlers.

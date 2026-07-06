# Stripe Apps Community Examples

> 🤓👓 **Not an official Stripe publication.** This is a community-maintained repo, unaffiliated with Stripe. Contributions welcome — and please steal this code and use it freely in your own project.

Example project for the Stripe Apps Community meetup: a complete Stripe App with a real backend.

> **🚧 Actively in development.** This repo is growing over time as new examples are added. See the roadmap below for what's done and what's coming.

## 📅 Community meetup

The Stripe Apps Developer meetup is now listed on the [Stripe Community website](https://www.stripecommunity.com/public/clubs/stripe-app-developers). This is not an official Stripe support channel — the goal is to help each other with real challenges that fall outside the scope of the Stripe docs. We post answers to questions raised in the community as code, right here in this repo.

**Upcoming meetups:**

| Date | Time | Link |
|---|---|---|
| Tue, Jul 7 | 2:00 PM – 2:40 PM EDT | [Join](https://www.stripecommunity.com/public/clubs/stripe-app-developers/events/stripe-app-developers-community-meetup-tlmu8nve5k) |
| Tue, Jul 21 | 2:00 PM – 3:00 PM EDT | [Join](https://www.stripecommunity.com/public/clubs/stripe-app-developers/events/stripe-app-developers-community-meetup-yrlvz6syxc) |

## Roadmap

- [x] Next.js API backend example
- [x] Secure backend routes:
  - [x] Local Dev API Keys
  - [x] Stripe Signing Signature Example
  - [x] Secure token url links from app
- [ ] Creative component examples: Password input, Address suggestion through Google Places API, Unified Container wrapper
- [ ] Login component with Better Auth backend
- [ ] Complex routing examples
- [ ] Full page app example
- [ ] Connected webhooks
- [ ] App user email notifications
- [ ] App paywall
- [ ] App monetization and user billing dashboard
- [ ] App trial strategies
- [ ] Demo documentation files: how to document your app to the public with markdoc.dev
- [ ] App settings (user, account-wide and test mode settings)
- [ ] Security best practices
- [ ] Hosting recommendation
- [ ] And much more

This repo contains two projects that work together:

| Folder | What it is | Runs on |
|---|---|---|
| [`stripe-app/`](stripe-app/) | A Stripe App (UI extension) that renders inside the Stripe Dashboard | Stripe CLI (`stripe apps start`) |
| [`nextjs-backend/`](nextjs-backend/) | A Next.js API backend with auth (Better Auth), Drizzle ORM, and Supabase Postgres | Local dev / Vercel |

```
Stripe Dashboard                         Your infrastructure
┌──────────────────────┐                ┌─────────────────────────┐
│  stripe-app          │   HTTPS/API    │  nextjs-backend         │
│  (UI extension,      │ ─────────────► │  (Next.js on Vercel)    │
│   React + UI SDK)    │                │   ├─ Better Auth        │
└──────────────────────┘                │   ├─ Drizzle ORM        │
        ▲                               │   └─ Stripe webhooks    │
        │ installs into                 └───────────┬─────────────┘
┌──────────────────────┐                            │
│  Stripe account      │ ── webhooks ──►            ▼
│  (test mode)         │                ┌─────────────────────────┐
└──────────────────────┘                │  Supabase (Postgres)    │
                                        └─────────────────────────┘
```

## Requirements

Before you start, you'll need:

- **Node.js 18+** (20+ recommended)
- **[Stripe account](https://dashboard.stripe.com/register)** — test mode is fine
- **[Stripe CLI](https://docs.stripe.com/stripe-cli)** with the [Stripe Apps plugin](https://docs.stripe.com/stripe-apps/create-app) — used to run and upload the app
  - Windows: `scoop install stripe` · macOS: `brew install stripe/stripe-cli/stripe`
  - Then: `stripe plugin install apps`
- **[Supabase account](https://supabase.com)** — free tier works; provides the Postgres database
- **[Vercel account](https://vercel.com)** — for deploying the backend (optional for local-only development)

## Quick start

### 1. Install everything

One install from the repo root sets up both projects:

```bash
npm install
```

(This runs `npm install` in `stripe-app/` and `nextjs-backend/` for you.)

### 2. Configure the backend

Run the one-time setup wizard from the repo root:

```bash
npm run setup
```

It generates every random secret for you (no `openssl` needed), helps you connect a Supabase database — an existing project or a brand-new free one, into the `public` schema or an isolated one — takes your Stripe test key, writes `nextjs-backend/.env.local`, and offers to create the database tables (`npm run db:push`).

While the [`nextjs-backend/delete_me_after_setup/`](nextjs-backend/delete_me_after_setup/) folder exists, the dev server home page (<http://localhost:3000>) shows a **live setup checklist** of anything still missing. When it's all green, delete that folder — the wizard, install banner, and checklist all disappear (none of it is used at runtime).

<details>
<summary>Prefer manual setup?</summary>

```bash
cd nextjs-backend
cp .env.example .env.local
```

1. **Supabase**: create a project at [supabase.com](https://supabase.com) and copy the connection string (Connect → Session pooler) into `DATABASE_URL`.
2. **Better Auth**: generate a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (same for the proxy-auth secrets — see `.env.example`).
3. **Stripe**: copy your test keys from the [Stripe dashboard](https://dashboard.stripe.com/test/apikeys).

Then create the database tables, either way:

- **Option A (CLI):** `npm run db:push` — pushes the Drizzle schema straight to Supabase.
- **Option B (SQL editor):** paste [nextjs-backend/setup.sql](nextjs-backend/setup.sql) into the Supabase SQL editor and run it. This file is generated from the schema — if you change `src/db/schema.ts`, run `npm run db:generate` to regenerate it.

</details>

See [nextjs-backend/QUICKSTART.md](nextjs-backend/QUICKSTART.md) for a detailed walkthrough, and [nextjs-backend/DEPLOYMENT_QUICK_START.md](nextjs-backend/DEPLOYMENT_QUICK_START.md) for deploying to Vercel.

### 3. Log in to Stripe

```bash
npm run stripe:login
```

### 4. Run both projects

From the repo root:

```bash
npm run dev
```

This starts the Next.js backend (<http://localhost:3000>) and the Stripe App preview (`stripe apps start`, which opens the Stripe Dashboard) side by side. You can also run them individually with `npm run dev:backend` and `npm run dev:app`.

## Root scripts

| Script | What it does |
|---|---|
| `npm install` | Installs dependencies for both projects |
| `npm run setup` | One-time setup wizard: writes `nextjs-backend/.env.local` (delete `nextjs-backend/delete_me_after_setup/` when done) |
| `npm run dev` | Runs backend + Stripe App preview together |
| `npm run dev:backend` | Next.js dev server only |
| `npm run dev:app` | Stripe App preview only |
| `npm run db:push` | Push Drizzle schema to Supabase |
| `npm run db:generate` | Generate a migration + rebuild `setup.sql` after schema changes |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run stripe:login` | Authenticate the Stripe CLI |
| `npm run stripe:upload` | Upload the app to Stripe |
| `npm run build:backend` | Production build of the backend |

## Before your first upload: rename the app

This example ships with the app ID `com.productivity.community-example`. **Stripe App IDs are globally unique across all of Stripe** — once an ID has been uploaded by one account, nobody else can upload an app with that ID. Local previewing (`npm run dev`) works fine with the ID as-is, but before you run `npm run stripe:upload` you must pick your own ID:

1. In [`stripe-app/stripe-app.json`](stripe-app/stripe-app.json), change `id` to something you own, using reverse-domain style (e.g. `com.yourcompany.your-app-name`). You can also change the display `name`.
2. Keep [`stripe-app/package.json`](stripe-app/package.json)'s `name` field in sync with the new ID (convention, not required).

Note: changing the `id` after installing a preview means Stripe treats it as a brand-new app — you'd need to install the new one and can uninstall the old.

## Upload early — you need it for the signing secret

The signed-request auth between the app and the backend (see [nextjs-backend/AUTHENTICATION.md](nextjs-backend/AUTHENTICATION.md)) verifies requests against your app's **signing secret** — and that secret **only exists after you run `stripe apps upload` once**. A locally previewed app doesn't have one yet: until the first upload, `fetchStripeSignature()` fails with `No such app: <your-app-id>`, so the demo view's requests can't even be signed. After uploading, copy the "Signing secret" from your app's settings page in the Developers Dashboard into `STRIPE_APP_SIGNING_SECRET` in `nextjs-backend/.env.local`.

**Uploading is not publishing, so don't worry about uploading.** An uploaded app is visible only to your own Stripe account — even if `stripe-app.json` declares a "public" distribution type. That "public" label is a misnomer: to make an app genuinely public you must additionally submit it for review, pass Stripe's review process, and build a Stripe App Marketplace listing — a long process you opt into separately. Upload freely during development.

## Learn more

- [Stripe Apps docs](https://docs.stripe.com/stripe-apps)
- [Stripe UI Extension SDK](https://docs.stripe.com/stripe-apps/ui)
- [nextjs-backend/ARCHITECTURE.md](nextjs-backend/ARCHITECTURE.md) — how the backend is put together
- [AGENTS.md](AGENTS.md) — notes for contributors (and AI agents) picking up this project

# Stripe Apps Community Examples

Example project for the Stripe Apps Community meetup: a complete Stripe App with a real backend.

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

```bash
cd nextjs-backend
cp .env.example .env.local
```

Fill in `.env.local`:

1. **Supabase**: create a project at [supabase.com](https://supabase.com), then copy from *Project Settings → API*: the URL (`NEXT_PUBLIC_SUPABASE_URL`), anon key, and service role key. Copy the connection string from *Project Settings → Database* into `DATABASE_URL`.
2. **Better Auth**: generate a secret with `openssl rand -hex 32` (or `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
3. **Stripe**: copy your test keys from the [Stripe dashboard](https://dashboard.stripe.com/test/apikeys).

Then create the database tables, either way:

- **Option A (CLI):** `npm run db:push` — pushes the Drizzle schema straight to Supabase.
- **Option B (SQL editor):** paste [nextjs-backend/setup.sql](nextjs-backend/setup.sql) into the Supabase SQL editor and run it. This file is generated from the schema — if you change `src/db/schema.ts`, run `npm run db:generate` to regenerate it.

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

This starts the Next.js backend (http://localhost:3000) and the Stripe App preview (`stripe apps start`, which opens the Stripe Dashboard) side by side. You can also run them individually with `npm run dev:backend` and `npm run dev:app`.

## Root scripts

| Script | What it does |
|---|---|
| `npm install` | Installs dependencies for both projects |
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

## Learn more

- [Stripe Apps docs](https://docs.stripe.com/stripe-apps)
- [Stripe UI Extension SDK](https://docs.stripe.com/stripe-apps/ui)
- [nextjs-backend/ARCHITECTURE.md](nextjs-backend/ARCHITECTURE.md) — how the backend is put together
- [AGENTS.md](AGENTS.md) — notes for contributors (and AI agents) picking up this project

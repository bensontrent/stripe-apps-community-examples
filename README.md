# Stripe Apps Community Examples

> 🤓👓 **Not an official Stripe publication.** This is a community-maintained repo, unaffiliated with Stripe. Contributions welcome — and please steal this code and use it freely in your own project.

Quickstart for building a Stripe App with a real backend: a Stripe App (UI extension) plus a Next.js backend that is published as a **[Stripe Projects](https://docs.stripe.com/projects) build template** — one command scaffolds the backend with Vercel hosting already provisioned, and a short wizard connects your Supabase database.

```bash
stripe projects build my-stripe-app-backend --template bensontrent/stripe-app-nextjs-backend
```

## Who this is for

**The assumption throughout this repo: you are building a Stripe App for the [Stripe Apps Marketplace](https://marketplace.stripe.com), to be installed by thousands of Stripe accounts you don't control.** Every design choice — signed requests from the app to the backend, per-account authentication, the database keyed by Stripe account ID, connected webhooks, per-account settings and billing — treats each installing Stripe account as a separate tenant of your backend. Think of it as a roadmap for going from "it works in my Dashboard" to a reviewed, listed, multi-tenant Marketplace app.

You can also use this example as a **private app for a single company** (one Stripe account, distributed privately). Everything still works; you'll just find that some of the machinery — tenant isolation, install/uninstall handling, paywalls, trials — is more than a one-account app needs and can be trimmed.

> **🚧 Actively in development.** This repo is growing over time as new examples are added. See the roadmap below for what's done and what's coming.

## 📅 Community meetup

The Stripe Apps Developer meetup is now listed on the [Stripe Community website](https://www.stripecommunity.com/public/clubs/stripe-app-developers). This is not an official Stripe support channel — the goal is to help each other with real challenges that fall outside the scope of the Stripe docs. We post answers to questions raised in the community as code, right here in this repo.

**Upcoming meetups:**

| Date | Time | Link |
| --- | --- | --- |
| Thurs, Oct 1 | 3:00 PM - 4:30 PM EDT | [Join](https://www.stripecommunity.com/public/clubs/stripe-apps-developers/events/stripe-apps-developers-simplify-building-your-tech-stack-with-ai-qs0kjzpwtj) |

## Roadmap

- [x] Next.js API backend example
- [x] Secure backend routes:
  - [x] Local Dev API Keys
  - [x] Stripe Signing Signature Example
  - [x] Secure token url links from app
  - [x] User login & authentication from Stripe app to next.js
- [ ] Creative component examples: Password input, Address suggestion through Google Places API, Unified Container wrapper
- [x] Login component with Better Auth backend
- [x] Backend as a Stripe Projects build template (Vercel provisioned by the CLI, `npm run deploy`; Supabase optional)
- [x] Stripe Projects support
- [x] Complex routing examples
- [x] Full page app example
- [ ] Connected webhooks
- [ ] App user email notifications
- [ ] App paywall
- [ ] App monetization and user billing dashboard
- [ ] App trial strategies
- [X] Demo documentation files: how to document your app to the public with markdoc.dev
- [x] App settings (user, account-wide and test mode settings) — [docs](stripe-app-nextjs-backend/src/content/docs/app-settings.md), demo at `/examples/app-settings` in the app
- [ ] Security best practices
- [ ] Hosting recommendation
- [ ] And much more

## What's in the repo

| Folder | What it is | Runs on |
| --- | --- | --- |
| [`stripe-app-nextjs-backend/`](stripe-app-nextjs-backend/) | The Next.js backend — auth (Better Auth), Supabase Postgres, Stripe webhooks, signed-request routes. **This is the Stripe Projects template** ([manifest](stripe-app-nextjs-backend/projects-template.yaml)). | Local dev / Vercel |
| [`stripe-app/`](stripe-app/) | The Stripe App (UI extension): a full-page Dashboard view routed with `@stripe/ui-extension-sdk/navigation` (tabs, list-to-detail, search params, redirects) plus a drawer that links into it. The backend auth demo lives at `/examples/authentication`. Maintained as its own repo and included here as a reference. | Stripe CLI (`stripe apps start`) |

```
Stripe Dashboard                         Your infrastructure
┌──────────────────────┐                ┌───────────────────────────────┐
│  stripe-app          │   HTTPS/API    │  stripe-app-nextjs-backend    │
│  (UI extension,      │ ─────────────► │  (Next.js on Vercel —         │
│   React + UI SDK)    │                │   provisioned by Projects)    │
└──────────────────────┘                │   ├─ Better Auth              │
        ▲                               │   ├─ Supabase client          │
        │ installs into                 │   └─ Stripe webhooks          │
┌──────────────────────┐                └───────────┬───────────────────┘
│  Stripe accounts     │ ── webhooks ──►            ▼
│  (one per install)   │                ┌───────────────────────────────┐
└──────────────────────┘                │  Supabase (Postgres) —        │
                                        │  yours, connected by setup    │
                                        └───────────────────────────────┘
```

## Requirements

- **Node.js 20.9+**
- **[Stripe account](https://dashboard.stripe.com/register)** — test mode is fine
- **[Stripe CLI](https://docs.stripe.com/stripe-cli)** 1.43+ with two plugins:
  - Windows: `scoop install stripe` · macOS: `brew install stripe/stripe-cli/stripe` · or `npm install -g @stripe/cli`
  - `stripe plugin install apps` — runs and uploads the Stripe App
  - `stripe plugin install projects` — provisions Vercel (and optionally Supabase) and syncs credentials
  - Then `stripe login`
- **[Supabase account](https://supabase.com)** — free tier works; the setup wizard creates the project with you if you don't have one, or can have Stripe Projects provision a fresh one
- No Vercel sign-up needed: Stripe Projects creates the account and project for you (free tier) and bills any upgrades through Stripe

## Quick start

### Path A — build the backend from the template (new project)

```bash
stripe projects build my-stripe-app-backend --template bensontrent/stripe-app-nextjs-backend
cd my-stripe-app-backend
npm run setup      # connect Supabase, generate secrets, Stripe test key, database tables
npm run dev        # http://localhost:3006
```

Then get the Stripe App and run it against that backend:

```bash
git clone https://github.com/bensontrent/stripe-app-community-example.git stripe-app
cd stripe-app && npm install && stripe apps start
```

### Path B — clone this repo (both projects together)

```bash
git clone --recurse-submodules https://github.com/bensontrent/stripe-apps-community-examples.git
cd stripe-apps-community-examples
npm install                          # installs both projects
cd stripe-app-nextjs-backend
stripe projects init                 # creates the Stripe project for this checkout
stripe projects add vercel/project   # hosting, credentials → .env
cd ..
npm run setup                        # connect Supabase, secrets, Stripe test key, database tables
npm run dev                          # backend + Stripe App preview side by side
```

`npm run dev` starts the Next.js backend (<http://localhost:3006>) and the Stripe App preview (`stripe apps start`, which opens the Stripe Dashboard). Run them individually with `npm run dev:backend` and `npm run dev:app`.

### About the database

`npm run setup` asks where your Postgres lives and offers three choices: a Supabase project you already have (paste the *Session pooler* connection string and API keys, optionally into a dedicated schema so the demo doesn't use up a free-tier project slot), a new free project you create at [database.new](https://database.new), or a brand-new project provisioned by Stripe Projects (`stripe projects add supabase/project`). The Projects connector can't reuse an existing project or pick a schema, which is why it's an option and not the default. Prefer it up front? The template has a second variant that provisions Supabase during the build:

```bash
stripe projects build my-stripe-app-backend --template bensontrent/stripe-app-nextjs-backend/supabase-vercel
```

<details>
<summary>Prefer fully manual setup?</summary>

```bash
cd stripe-app-nextjs-backend
cp .env.example .env.local
```

Fill in `DATABASE_URL` (Connect → Session pooler), `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API Keys), generate the secrets, paste your Stripe test key, and create the tables by pasting [setup.sql](stripe-app-nextjs-backend/setup.sql) into the Supabase SQL editor or running `npm run db:setup`. Set `SUPABASE_SCHEMA` to keep the tables in a dedicated schema instead of `public` (then add it to *Exposed schemas* under Settings → API).

</details>

While anything is missing, the backend home page (<http://localhost:3006>) shows a **live setup checklist** with the fix for each item. See [stripe-app-nextjs-backend/QUICKSTART.md](stripe-app-nextjs-backend/QUICKSTART.md) for the detailed walkthrough and [DEPLOYMENT_QUICK_START.md](stripe-app-nextjs-backend/DEPLOYMENT_QUICK_START.md) for going to production with `npm run deploy`.

## Root scripts

| Script | What it does |
| --- | --- |
| `npm install` | Installs dependencies for both projects |
| `npm run setup` | Connects Supabase, fills in `stripe-app-nextjs-backend/.env.local` (secrets, Stripe test key) and creates the tables — idempotent |
| `npm run dev` | Runs backend + Stripe App preview together |
| `npm run dev:backend` | Next.js dev server only |
| `npm run dev:app` | Stripe App preview only |
| `npm run db:setup` | Create the database tables (applies `setup.sql`; no-op if they exist) |
| `npm run deploy:backend` | Deploy the backend to the Vercel project Stripe Projects created |
| `npm run stripe:login` | Authenticate the Stripe CLI |
| `npm run stripe:upload` | Upload the app to Stripe |
| `npm run build:backend` | Production build of the backend |

## Before your first upload: rename the app

This example ships with the app ID `com.productivity.community-example`. **Stripe App IDs are globally unique across all of Stripe** — once an ID has been uploaded by one account, nobody else can upload an app with that ID. Local previewing (`npm run dev`) works fine with the ID as-is, but before you run `npm run stripe:upload` you must pick your own ID:

1. In [`stripe-app/stripe-app.json`](stripe-app/stripe-app.json), change `id` to something you own, using reverse-domain style (e.g. `com.yourcompany.your-app-name`). You can also change the display `name`.
2. Keep [`stripe-app/package.json`](stripe-app/package.json)'s `name` field in sync with the new ID (convention, not required).

Note: changing the `id` after installing a preview means Stripe treats it as a brand-new app — you'd need to install the new one and can uninstall the old.

## Upload early — you need it for the signing secret

The signed-request auth between the app and the backend (see [stripe-app-nextjs-backend/AUTHENTICATION.md](stripe-app-nextjs-backend/AUTHENTICATION.md)) verifies requests against your app's **signing secret** — and that secret **only exists after you run `stripe apps upload` once**. A locally previewed app doesn't have one yet: until the first upload, `fetchStripeSignature()` fails with `No such app: <your-app-id>`, so the demo view's requests can't even be signed. After uploading, copy the "Signing secret" from your app's settings page in the Developers Dashboard into `STRIPE_APP_SIGNING_SECRET` in `stripe-app-nextjs-backend/.env.local`.

**Uploading is not publishing, so don't worry about uploading.** An uploaded app is visible only to your own Stripe account — even if `stripe-app.json` declares a "public" distribution type. That "public" label is a misnomer: to make an app genuinely public you must additionally submit it for review, pass Stripe's review process, and build a Stripe App Marketplace listing — a long process you opt into separately. Upload freely during development.

## How the template works

`stripe projects build` reads a manifest, copies [`stripe-app-nextjs-backend/`](stripe-app-nextjs-backend/) at a pinned commit, runs `npm install`, provisions the services in the manifest and prints the next steps. The pieces that make the backend template-ready:

- [`projects-template.yaml`](stripe-app-nextjs-backend/projects-template.yaml) — the default manifest (Vercel only; Supabase connected by the wizard). [`projects-template.supabase-vercel.yaml`](stripe-app-nextjs-backend/projects-template.supabase-vercel.yaml) is the variant that provisions Supabase too. The copies submitted to the registry live in Stripe's repo; these are the source of truth.
- [`scripts/setup.mjs`](stripe-app-nextjs-backend/scripts/setup.mjs) — `npm run setup`: everything Stripe Projects doesn't provide (the Supabase connection, random secrets, Stripe test key from `stripe login`, database tables), safe to re-run, non-interactive when there's no terminal.
- [`src/lib/env.ts`](stripe-app-nextjs-backend/src/lib/env.ts) — maps the variable names the Supabase provider writes (`SUPABASE_POOLER_URL`, `SUPABASE_PROJECT_URL`, `SUPABASE_SECRET_KEY`) onto the names the code reads, so the Projects route works without touching the code.
- [`scripts/deploy-vercel.mjs`](stripe-app-nextjs-backend/scripts/deploy-vercel.mjs) — `npm run deploy`: syncs env vars to the Vercel project and starts a production deployment with the credentials Projects wrote.

### Publishing the template to the registry

1. Push, then pin: `git rev-parse HEAD` → the `ref` field in both manifests.
2. Fork [stripe/projects-template-registry](https://github.com/stripe/projects-template-registry), add them as `stripe_app_backend/vercel.yaml` and `stripe_app_backend/supabase-vercel.yaml`, open a PR.
3. Test before publishing with `stripe projects build my-app --template-manifest /absolute/path/to/projects-template.yaml`.

Docs: [Create a build template](https://docs.stripe.com/projects/templates).

### The Stripe App as a separate repo

The UI extension is maintained in its own repo — the template's "next steps" tell backend users to clone it — and included here as a git submodule so the two projects can still be run together with `npm run dev`. Clone with `--recurse-submodules` (or run `git submodule update --init`); `cd stripe-app && git pull` to move the reference forward.

## Learn more

- [Stripe Apps docs](https://docs.stripe.com/stripe-apps)
- [Stripe UI Extension SDK](https://docs.stripe.com/stripe-apps/ui)
- [Stripe Projects](https://docs.stripe.com/projects) — the CLI that provisions the backend's hosting
- [stripe-app-nextjs-backend/ARCHITECTURE.md](stripe-app-nextjs-backend/ARCHITECTURE.md) — how the backend is put together
- [AGENTS.md](AGENTS.md) — notes for contributors (and AI agents) picking up this project

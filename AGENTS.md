# AGENTS.md — notes for whoever picks this up next

Context: this repo is being prepared for a **Stripe Apps Community meetup**. The goal is a single Git repo containing two cooperating projects, with a root README and one `package.json` that installs both.

## Repo layout

- `stripe-app/` — Stripe App UI extension (`@stripe/ui-extension-sdk` 9.x, React 18). Currently the "Show Toast" example (`stripe-app.json` id: `com.example.my-stripe-app`, drawer view). Run with `stripe apps start`.
- `nextjs-backend/` — Next.js 16 backend: Better Auth (email/password + sessions), Drizzle ORM → Supabase Postgres, Stripe webhook handler. Has its own good docs: `README.md`, `QUICKSTART.md`, `ARCHITECTURE.md`, `DEPLOYMENT_QUICK_START.md`.
- Root `package.json` — no npm workspaces (deliberate, see below). `postinstall` runs `npm install --prefix` in each subfolder, so a single `npm install` at the root sets up everything. `npm run dev` uses `concurrently` to run both.

## ⚠️ Things to fix before the first commit to the single repo

1. ~~`nextjs-backend/.git` exists~~ — **DONE (2026-07-05):** the nested `.git` folder was deleted, so the backend's old standalone history is gone. The root is not yet a git repo; `git init` + initial commit is the next step.
2. **`stripe-app/` has NO `.gitignore`** — a root `.gitignore` was added covering `node_modules/`, `.next/`, `.env*`, etc., so this is handled at the root level. Verify with `git status` before the first commit that `node_modules` and `.env.local` are not staged.
3. **`nextjs-backend/.env.local` exists on disk with real credentials** — the root `.gitignore` excludes it, but double-check it never gets committed.
4. ~~Mixed lockfiles~~ — **DONE (2026-07-05):** all lockfiles were deleted (`stripe-app/yarn.lock`, `stripe-app/package-lock.json`, `nextjs-backend/package-lock.json`, root `package-lock.json`). The next `npm install` at the root will regenerate npm lockfiles in all three locations — commit those regenerated `package-lock.json` files so meetup attendees get reproducible installs.

## Decisions made (and why)

- **No npm workspaces.** The Stripe CLI builds the app from `stripe-app/` and expects its dependencies locally; hoisting to a root `node_modules` is a risk not worth taking days before a live demo. `--prefix` scripts are boring and reliable.
- **`postinstall` chains the two installs** so `npm install` at root "just works" for meetup attendees.
- Root README intentionally stays high-level and links into `nextjs-backend/`'s existing docs rather than duplicating them.

## Known quirks / mismatches (not blocking, worth knowing)

- `stripe` SDK versions differ: `stripe-app` pins `20.1.0`, backend uses `^21.0.0`. Fine since they don't share code, but align if you ever extract shared types.
- `stripe-app/package.json` name is `com.example.show-toast` while `stripe-app.json` id is `com.example.my-stripe-app` — cosmetic, but rename both to something meetup-appropriate before uploading.
- `nextjs-backend/README.md` says "Next.js 15" but `package.json` has Next 16.2.9 — stale doc line.
- `nextjs-backend/QUICKSTART.md` has mangled code fences (escaped backticks / `\\\ash`) — needs a cleanup pass.
- Backend `auth-schema.ts` sits at the project root (Better Auth generated) alongside `src/db/schema.ts` — check which one Drizzle config actually reads before schema changes.

## Suggested next session tasks

1. Run `npm install` at the root to regenerate lockfiles, then `git init` at root and make the initial commit (check `git status` for `node_modules` / `.env.local` first).
2. Wire the Stripe App to actually call the backend (add `connect-src` in `stripe-app.json` CSP → the Vercel/localhost backend URL, and use `fetchStripeSignature` for signed requests).
3. Rename the app from "Show Toast" to the meetup demo name (`stripe-app.json` + `package.json`).
4. Clean up `QUICKSTART.md` formatting and the "Next.js 15" doc drift.
5. Optional: add a top-level `docs/` or slides link for the meetup.

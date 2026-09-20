# Community Example — Stripe App (UI extension)

> 🤓👓 **Not an official Stripe publication.** Community-maintained example
> from the Stripe Apps Developer meetup. Steal this code freely.

A Stripe App that renders a drawer inside the Stripe Dashboard and talks to a
companion Next.js backend. It demonstrates the client side of three auth
patterns:

1. **Signed requests** — every fetch carries a `stripe-signature` header from
   `fetchStripeSignature()`; the backend verifies it against the app's signing
   secret, so no login or API key is needed ("Verify connection").
2. **JWT-in-URL tokens** — exchange a signed request for a short-lived link
   that authenticates itself via its query string ("Create download link").
3. **User login from the Dashboard** — a browser-tab handshake links the
   Dashboard user to a Better Auth account on the backend (`Login.tsx`).

The backend it talks to is
[`stripe-app-nextjs-backend`](https://github.com/bensontrent/stripe-apps-community-examples/tree/main/stripe-app-nextjs-backend)
— a Stripe Projects build template you can scaffold with one command:

```bash
stripe projects build my-stripe-app-backend --template bensontrent/stripe-app-nextjs-backend
```

## Requirements

- Node.js 18+ (20+ recommended)
- [Stripe CLI](https://docs.stripe.com/stripe-cli) with the Stripe Apps plugin:
  `stripe plugin install apps`
- The backend running locally (`npm run dev` in `stripe-app-nextjs-backend`, port 3006)

## Run it

```bash
npm install
stripe login
stripe apps start
```

`stripe apps start` opens the Stripe Dashboard with the app previewed. Open a
drawer (e.g. on a customer) and use the demo buttons. The backend URL is
`http://localhost:3006` in development (`src/api/backend.ts`); previews may
fetch `localhost` without a CSP entry.

## Before your first upload: rename the app

This example ships with the app ID `com.productivity.community-example`.
**Stripe App IDs are globally unique across all of Stripe** — once an ID has
been uploaded by one account, nobody else can upload an app with that ID.
Local previewing works with the ID as-is, but before `stripe apps upload`:

1. In [`stripe-app.json`](stripe-app.json), change `id` to something you own,
   reverse-domain style (e.g. `com.yourcompany.your-app-name`). You can also
   change the display `name`.
2. Keep [`package.json`](package.json)'s `name` in sync (convention, not required).

Changing the `id` after installing a preview means Stripe treats it as a
brand-new app — install the new one and uninstall the old.

## Upload early — you need it for the signing secret

Signed requests verify against your app's **signing secret**, which only
exists after you run `stripe apps upload` once. Until then
`fetchStripeSignature()` fails with `No such app: <your-app-id>`. After
uploading, copy the "Signing secret" from your app's settings page in the
Developers Dashboard into `STRIPE_APP_SIGNING_SECRET` in the backend's
`.env.local`.

**Uploading is not publishing.** An uploaded app is visible only to your own
Stripe account. Making it public means separately submitting it for review
and building a Marketplace listing. Upload freely during development.

## Pointing at a deployed backend

1. `src/api/backend.ts` → `BACKEND_BASE = 'https://your-backend.example.com'`
2. `stripe-app.json` → `content_security_policy.connect-src` must list
   `https://your-backend.example.com/api/` (published apps can only reach
   listed URLs)
3. `stripe apps upload`

## Structure

```
stripe-app/
├── stripe-app.json        # App manifest: id, views, CSP
├── src/
│   ├── views/App.tsx      # The drawer view (three demo sections)
│   ├── components/
│   │   ├── Login.tsx      # Dashboard-user login state machine
│   │   └── Form.tsx
│   ├── api/backend.ts     # Signed-fetch client + example calls
│   └── events.ts
└── app_icon.png
```

## Scripts

| Script | What it does |
|---|---|
| `npm start` | `stripe apps start` — preview in the Dashboard |
| `npm run upload` | `stripe apps upload` |
| `npm run login` | `stripe login` |
| `npm test` | Jest |

## Learn more

- [Stripe Apps docs](https://docs.stripe.com/stripe-apps)
- [Stripe UI Extension SDK](https://docs.stripe.com/stripe-apps/ui)
- Backend docs: [AUTHENTICATION.md](https://github.com/bensontrent/stripe-apps-community-examples/blob/main/stripe-app-nextjs-backend/AUTHENTICATION.md)

## License

MIT — see [LICENSE](LICENSE).

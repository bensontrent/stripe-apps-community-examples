# delete_me_after_setup/ — run-once setup scaffolding

Everything in this folder exists only for first-time setup. **Once your app is
configured, delete this whole folder** — nothing in it is used at runtime.

| File | What it does |
|---|---|
| `setup.mjs` | The interactive wizard (`npm run setup` from the repo root). Generates every random secret, walks you through connecting a Supabase database (an existing project or a new free one, into `public` or an isolated schema), takes your Stripe test key, writes `nextjs-backend/.env.local`, and offers to create the database tables. `npm run setup -- --dry-run` shows the file it would write without writing anything. |
| `banner.js` | Prints the "run `npm run setup`" reminder after `npm install` and before `npm run dev`. |

While this folder exists, the dev server home page (<http://localhost:3006>)
shows a live setup checklist rendered by `src/components/SetupChecklist.tsx`.

Deleting this folder:

- removes the install/dev banner (the hooks in the root `package.json` no-op),
- hides the checklist on the home page,
- retires `npm run setup` (there is nothing left for it to run).

`src/components/SetupChecklist.tsx` stays behind but renders nothing once the
folder is gone — delete that file too if you want a spotless tree.

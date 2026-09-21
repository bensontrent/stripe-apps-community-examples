---
title: App settings
description: User-scoped, account-wide and per-mode settings for your Stripe App — two tables, one hook, no login, no cache.
order: 4
---

Most Stripe Apps need to remember a few preferences. Some belong to the
whole Stripe account ("our company name", "notify customers"), some to the
person using the app ("my label printer"), and all of them should be kept
apart between test and live mode. This backend stores them in **two
tables**, one row per owner per mode, and hands the Stripe App one flat
settings object to read.

| Scope | Table | Row key | Who sees it |
| ----- | ----- | ------- | ----------- |
| `account` | `account_settings` | `(stripe_account_id, livemode)` | Everyone using the app in that Stripe account |
| `user` | `user_settings` | `(stripe_account_id, stripe_user_id, livemode)` | That Dashboard user, in that account |

The owner ids are the ones every signed request from the app already
carries — the Stripe account (`acct_…`) and the Dashboard user (`usr_…`) —
so **settings need no login**: they work from the first request after the
app is installed. The Better Auth login described in
[Authentication](/docs/authentication) is a separate, optional step for
things that need an account of their own, such as paying for the app.

Test mode and live mode are **different rows**: what you configure in test
mode never applies in live mode. The same two routes serve both — the app
sends its current mode in the `stripe-mode` header and the backend reads
or writes that mode's row.

## One file decides where a setting lives

`src/types/settings.ts` is the whole model — the types, the defaults, and a
map that says which scope each key has:

```ts
export type AccountSettings = {
  companyName: string;
  customerNotifications: boolean;
};

export type UserSettings = {
  labelSize: '4x6' | '8.5x11';
  printPackingSlips: boolean;
};

export const SETTING_DEFINITIONS: Record<SettingKey, SettingDefinition> = {
  companyName: { scope: 'account' },
  customerNotifications: { scope: 'account' },
  labelSize: { scope: 'user', options: ['4x6', '8.5x11'] },
  printPackingSlips: { scope: 'user' },
};
```

An **identical copy** lives in the Stripe App at `stripe-app/src/types/settings.ts`.
The backend uses it to validate writes; the app uses it for the hook's types
and for optimistic updates. To add a setting, add the key to one of the two
types, give it a default, and add it to the map — in both files. TypeScript
refuses to compile until the three agree.

## Reading: `GET /api/stripe-app/settings`

Signed-request auth only: the proxy verifies `stripe-signature` and the
route takes `stripe-account-id` and `stripe-user-id` from the verified
headers. The response, for the mode in the `stripe-mode` header:

```json
{
  "settings": { "companyName": "Acme", "customerNotifications": false, "labelSize": "4x6", "printPackingSlips": true },
  "account":  { "companyName": "Acme" },
  "user":     { "printPackingSlips": true },
  "mode": "test"
}
```

`settings` is what the app reads: defaults, then the account row, then the
user row, each contributing only its own keys. `account` and `user` are the
values actually stored, so a UI can show "this is the default" versus
"someone set this". A row that doesn't exist yet (nothing saved in that
mode) simply contributes nothing. The merge is `resolveSettings()` in
`src/types/settings.ts`; the route is `src/app/api/stripe-app/settings/route.ts`
and the database reads are in `src/lib/settings.ts`.

## Writing: `PATCH /api/stripe-app/settings`

```json
{ "scope": "account", "settings": { "companyName": "Acme", "customerNotifications": null } }
```

Keys are merged into that scope's row for the current mode; `null` deletes
a key so the default applies again. The backend rejects unknown keys, keys
that belong to the other scope, and wrong-typed values with a 400 — the
jsonb column can only ever hold what the definitions describe. The
response is the same payload as GET, so the app replaces its state in one
step.

{% callout type="info" title="Who may change account-wide settings?" %}
Every Dashboard user of the account, in this example — the signature says
nothing about roles. If your app needs owner-only settings, gate the
`account` scope on something you know about the user, for instance the
`memberships.role` recorded once they have logged in.
{% /callout %}

### The merge happens in Postgres

The obvious implementation — read the row, spread the patch over it in
JavaScript, write it back — loses data as soon as two saves overlap, which
happens whenever a user flips two switches quickly. So `setup.sql` defines
`settings_merge(current, patch)` and two upsert wrappers,
`patch_user_settings` and `patch_account_settings`, and the backend calls
them through supabase-js:

```ts
await supabase.rpc('patch_account_settings', {
  p_account_id: accountId,
  p_livemode: mode === 'live',
  p_patch: { companyName: 'Acme', customerNotifications: null },
});
```

One statement: the row for that mode is created on the first save (along
with the `stripe_accounts` row it hangs off) and merged into afterwards,
the patch's keys win, null values are dropped. No lock, no retry. Row Level
Security still applies inside the functions, so the public anon key can't
use them either.

{% callout type="info" title="Already created the tables?" %}
Re-run `npm run db:setup` (or paste `setup.sql` into the SQL editor again).
The file is idempotent: it adds the settings tables and functions and its
"Upgrades" section drops the old `settings` columns, leaving your data
alone.
{% /callout %}

## The hook: `useSettings()`

In the Stripe App, `src/hooks/useSettings.tsx` wraps the two routes:

```tsx
<SettingsProvider context={context}>
  <PrinterSettings />
</SettingsProvider>

function PrinterSettings() {
  const { settings, updateUserSettings, updateAccountSettings } = useSettings();
  return (
    <Switch
      label="Print packing slips"
      checked={settings.printPackingSlips}
      onChange={(e) => updateUserSettings({ printPackingSlips: e.target.checked })}
    />
  );
}
```

`updateUserSettings` and `updateAccountSettings` are typed against
`UserSettings` and `AccountSettings`, so sending a key to the wrong scope is
a compile error before it can be a 400. Updates are optimistic; if a PATCH
fails the provider reloads from the backend so the UI never keeps a value
the database doesn't have. The full demo is at `/examples/app-settings` in
the app and in its drawer (`src/components/SettingsDemo.tsx`).

## Why there is no cache

The settings read is two primary-key lookups. Postgres answers in about a
millisecond, well under the latency of the Dashboard round trip itself. A
Redis layer in front of that — which is what Parcelcraft's production
backend does — means a second service to run and a set of invalidation
rules to get exactly right, and every mistake surfaces as "I changed the
setting but the app still shows the old one". Keep one copy in React state
for the life of the view (that is what `SettingsProvider` is) and let the
database be the source of truth.

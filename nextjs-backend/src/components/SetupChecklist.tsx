import fs from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';

// First-run setup checklist shown on the home page. It only renders while the
// run-once scaffolding folder exists, and never in production builds — delete
// nextjs-backend/delete_me_after_setup/ and this component renders nothing
// (at which point this file can be deleted too).

const SETUP_DIR = 'delete_me_after_setup';

type Status = 'done' | 'todo' | 'optional';

interface Item {
    status: Status;
    label: string;
    detail?: string;
    fix: ReactNode;
}

// A value counts as configured when it isn't blank or one of the placeholder
// shapes used by .env.example / the setup wizard. Mirrored in
// delete_me_after_setup/setup.mjs.
function configured(value: string | undefined): value is string {
    if (!value) return false;
    return !/REPLACE_ME|your-|\.\.\.$|\[YOUR-PASSWORD\]|localhost:5432\/dbname/.test(value);
}

async function probeDatabase(schema: string) {
    try {
        const { Client } = await import('pg');
        const client = new Client({
            connectionString: process.env.DATABASE_URL,
            connectionTimeoutMillis: 5000,
        });
        await client.connect();
        try {
            const { rows } = await client.query(
                `select 1 from information_schema.tables
                 where table_schema = $1 and table_name = 'users'`,
                [schema],
            );
            return { connected: true, hasTables: rows.length > 0, error: undefined };
        } finally {
            await client.end();
        }
    } catch (err) {
        return {
            connected: false,
            hasTables: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

// For a dedicated SUPABASE_SCHEMA only: checks that supabase-js can actually
// query the schema through Supabase's REST API. This fails until the schema
// is added to "Exposed schemas" in the dashboard — a step SQL can't automate.
async function probeSupabaseRest(schema: string) {
    try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL as string,
            process.env.SUPABASE_SERVICE_ROLE_KEY as string,
            { db: { schema }, auth: { persistSession: false } },
        );
        const { error } = await supabase.from('users').select('id', { head: true, count: 'exact' });
        return { ok: !error, error: error?.message };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

function Code({ children }: { children: ReactNode }) {
    return (
        <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[13px] dark:bg-white/[.12]">
            {children}
        </code>
    );
}

const ICONS: Record<Status, ReactNode> = {
    done: <span className="w-4 shrink-0 text-green-600 dark:text-green-400">✓</span>,
    todo: <span className="w-4 shrink-0 text-red-500 dark:text-red-400">✗</span>,
    optional: <span className="w-4 shrink-0 text-zinc-400">○</span>,
};

export default async function SetupChecklist() {
    if (process.env.NODE_ENV === 'production') return null;
    if (!fs.existsSync(path.join(process.cwd(), SETUP_DIR))) return null;

    const env = process.env;
    const schema = env.SUPABASE_SCHEMA || 'public';
    const hasEnvFile = fs.existsSync(path.join(process.cwd(), '.env.local'));
    const dbConfigured = configured(env.DATABASE_URL);
    const supabaseKeysConfigured =
        configured(env.NEXT_PUBLIC_SUPABASE_URL) && configured(env.SUPABASE_SERVICE_ROLE_KEY);
    const db = dbConfigured
        ? await probeDatabase(schema)
        : { connected: false, hasTables: false, error: undefined };
    // The exposure check only matters for a dedicated schema (public is
    // exposed out of the box), and is only meaningful once keys + tables exist.
    const rest =
        schema !== 'public' && supabaseKeysConfigured && db.hasTables
            ? await probeSupabaseRest(schema)
            : { ok: false, error: undefined };

    const items: Item[] = [
        {
            status: hasEnvFile ? 'done' : 'todo',
            label: '.env.local exists',
            fix: (
                <>
                    Run <Code>npm run setup</Code> from the repo root — the wizard writes the file,
                    generates every secret and walks you through the rest of this list.
                </>
            ),
        },
        {
            status: dbConfigured && db.connected ? 'done' : 'todo',
            label: dbConfigured
                ? 'Database reachable'
                : 'Database connection (DATABASE_URL)',
            detail: db.error,
            fix: (
                <>
                    Create a free Supabase project at{' '}
                    <a className="underline" href="https://database.new" target="_blank" rel="noreferrer">
                        Supabase
                    </a>
                    , click <em>Connect</em> in its toolbar, copy the <em>Session pooler</em>{' '}
                    connection string into <Code>DATABASE_URL</Code> in <Code>.env.local</Code>{' '}
                    (replace <Code>[YOUR-PASSWORD]</Code>), then restart the dev server.
                </>
            ),
        },
        {
            status: supabaseKeysConfigured ? 'done' : 'todo',
            label: 'Supabase API keys (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)',
            fix: (
                <>
                    In the Supabase dashboard open <em>Project Settings → API Keys</em> and copy the{' '}
                    project URL and the <Code>service_role</Code> secret key into{' '}
                    <Code>.env.local</Code>. The backend uses them for all data access.
                </>
            ),
        },
        {
            status: db.hasTables ? 'done' : 'todo',
            label:
                schema === 'public'
                    ? 'Database tables created'
                    : `Database tables created in schema “${schema}”`,
            fix: (
                <>
                    Run <Code>npm run db:setup</Code> from the repo root
                    {schema === 'public' ? (
                        <>
                            {' '}
                            (or paste <Code>nextjs-backend/setup.sql</Code> into the Supabase SQL
                            editor)
                        </>
                    ) : (
                        <>
                            {' '}
                            — it creates the <Code>{schema}</Code> schema, installs the tables there
                            and grants the Supabase API roles access. Prefer the SQL editor? Run{' '}
                            <Code>npm run db:setup -- --print</Code> and paste its output instead
                        </>
                    )}
                    .
                </>
            ),
        },
        ...(schema !== 'public'
            ? [
                  {
                      status: (rest.ok ? 'done' : 'todo') as Status,
                      label: `Schema “${schema}” exposed to the Supabase API`,
                      detail: rest.error,
                      fix: (
                          <>
                              In the Supabase dashboard open <em>Settings → API</em> and add{' '}
                              <Code>{schema}</Code> to <em>Exposed schemas</em>, then reload this
                              page. Until then <Code>supabase-js</Code> can&apos;t query the schema
                              even though the tables exist. (This check runs once the API keys are
                              set and the tables are created.)
                          </>
                      ),
                  },
              ]
            : []),
        {
            status:
                configured(env.BETTER_AUTH_SECRET) && env.BETTER_AUTH_SECRET.length >= 32
                    ? 'done'
                    : 'todo',
            label: 'Auth secret (BETTER_AUTH_SECRET)',
            fix: (
                <>
                    <Code>npm run setup</Code> generates it, or set any random string of 32+ characters
                    in <Code>.env.local</Code>.
                </>
            ),
        },
        {
            status: (['URL_TOKEN_SECRET', 'BEARER_TOKEN_KEYS', 'DEV_API_KEY', 'CRON_SECRET'] as const).every(
                (key) => configured(env[key]),
            )
                ? 'done'
                : 'todo',
            label: 'Proxy secrets (URL_TOKEN_SECRET, BEARER_TOKEN_KEYS, DEV_API_KEY, CRON_SECRET)',
            fix: (
                <>
                    <Code>npm run setup</Code> generates all four; see <Code>.env.example</Code> for
                    what each one protects.
                </>
            ),
        },
        {
            status:
                configured(env.STRIPE_SECRET_KEY_TEST) && /^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY_TEST)
                    ? 'done'
                    : 'todo',
            label: 'Stripe test key (STRIPE_SECRET_KEY_TEST)',
            fix: (
                <>
                    Copy the test-mode secret key from{' '}
                    <a
                        className="underline"
                        href="https://dashboard.stripe.com/test/apikeys"
                        target="_blank"
                        rel="noreferrer"
                    >
                        dashboard.stripe.com/test/apikeys
                    </a>{' '}
                    into <Code>.env.local</Code>.
                </>
            ),
        },
        {
            status: configured(env.STRIPE_WEBHOOK_SECRET_TEST_CONNECTED) ? 'done' : 'todo',
            label: 'Webhook secret (STRIPE_WEBHOOK_SECRET_TEST_CONNECTED)',
            fix: (
                <>
                    In a separate terminal run{' '}
                    <Code>stripe listen --forward-to localhost:3000/api/stripe/webhook</Code> and copy
                    the printed <Code>whsec_…</Code> value into <Code>.env.local</Code>.
                </>
            ),
        },
        {
            status:
                configured(env.STRIPE_APP_SIGNING_SECRET) && /^absec_/.test(env.STRIPE_APP_SIGNING_SECRET)
                    ? 'done'
                    : 'optional',
            label: 'Stripe App signing secret (STRIPE_APP_SIGNING_SECRET)',
            fix: (
                <>
                    This secret only exists after your first <Code>npm run stripe:upload</Code>{' '}
                    (uploading is not publishing — the app stays private to your account). Copy the
                    “Signing secret” from your app’s page in the Stripe Developers Dashboard. Until
                    then, signed requests from the app’s UI extension will fail.
                </>
            ),
        },
    ];

    const done = items.filter((item) => item.status === 'done').length;
    const allDone = items.every((item) => item.status !== 'todo');

    return (
        <section className="w-full rounded-2xl border border-amber-300/60 bg-amber-50 p-6 text-left text-sm dark:border-amber-400/20 dark:bg-amber-950/20">
            <div className="mb-1 flex items-baseline justify-between gap-4">
                <h2 className="text-base font-semibold text-black dark:text-zinc-50">
                    First-time setup checklist
                </h2>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {done}/{items.length} done
                </span>
            </div>
            <p className="mb-4 text-zinc-600 dark:text-zinc-400">
                {allDone ? (
                    'Everything is configured — you can delete the setup folder (see below).'
                ) : (
                    <>
                        Fastest path: run <Code>npm run setup</Code> from the repo root. Or expand any
                        item for instructions. The page re-checks on every reload.
                    </>
                )}
            </p>
            <ul className="flex flex-col gap-2">
                {items.map((item) => (
                    <li key={item.label}>
                        {item.status === 'done' ? (
                            <p className="flex gap-2 text-zinc-700 dark:text-zinc-300">
                                {ICONS.done}
                                <span>{item.label}</span>
                            </p>
                        ) : (
                            <details>
                                <summary className="flex cursor-pointer gap-2 text-zinc-800 dark:text-zinc-200">
                                    {ICONS[item.status]}
                                    <span>
                                        {item.label}
                                        {item.status === 'optional' ? (
                                            <span className="text-zinc-400"> — can wait</span>
                                        ) : null}
                                    </span>
                                </summary>
                                <div className="mt-1 pl-6 text-zinc-600 dark:text-zinc-400">
                                    {item.fix}
                                    {item.detail ? (
                                        <p className="mt-1 font-mono text-xs text-red-500/80">{item.detail}</p>
                                    ) : null}
                                </div>
                            </details>
                        )}
                    </li>
                ))}
            </ul>
            <p className="mt-4 border-t border-amber-300/40 pt-3 text-xs text-zinc-500 dark:border-amber-400/10 dark:text-zinc-400">
                This panel only appears on the dev server while{' '}
                <Code>nextjs-backend/delete_me_after_setup/</Code> exists. When everything above is
                green, delete that folder — this message, the install banner and the setup wizard
                all disappear. (Optionally delete <Code>src/components/SetupChecklist.tsx</Code>{' '}
                too.) Edits to <Code>.env.local</Code> are picked up automatically; reload this page
                to re-check.
            </p>
        </section>
    );
}

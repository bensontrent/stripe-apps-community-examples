#!/usr/bin/env node
/*
 * One-time setup wizard for the Stripe Apps community example backend.
 *
 * Everything in delete_me_after_setup/ is run-once scaffolding: once your
 * .env.local is written and the checklist at http://localhost:3000 is green,
 * delete the whole folder — nothing in it is used at runtime.
 *
 * Run from the repo root:
 *   npm run setup                 interactive wizard
 *   npm run setup -- --dry-run    print the .env.local it would write, write nothing
 *
 * No dependencies — plain Node 18+. Secrets are generated locally with
 * node:crypto (no openssl needed) and nothing leaves your machine.
 */

import { exec, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.dirname(here);
const envPath = path.join(backendDir, '.env.local');
const dryRun = process.argv.includes('--dry-run');

// --- tiny terminal helpers ---------------------------------------------------

const tty = process.stdout.isTTY;
const paint = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = paint('1');
const dim = paint('2');
const red = paint('31');
const green = paint('32');
const yellow = paint('33');
const cyan = paint('36');

// A queued line reader instead of rl.question(): lines that arrive while no
// question is pending (piped input, fast typists) are kept, and EOF while a
// question is open becomes a clean error instead of a silent exit.
const rl = createInterface({ input: process.stdin, output: process.stdout });
const pendingLines = [];
const pendingWaiters = [];
let stdinClosed = false;
rl.on('line', (line) => {
  const waiter = pendingWaiters.shift();
  if (waiter) waiter(line);
  else pendingLines.push(line);
});
rl.on('close', () => {
  stdinClosed = true;
  while (pendingWaiters.length > 0) pendingWaiters.shift()(null);
});
rl.on('SIGINT', () => {
  console.log('\nSetup aborted.');
  process.exit(1);
});

function readLine(prompt) {
  process.stdout.write(prompt);
  if (pendingLines.length > 0) return Promise.resolve(pendingLines.shift());
  if (stdinClosed) return Promise.resolve(null);
  return new Promise((resolve) => pendingWaiters.push(resolve));
}

async function ask(question, { def = '', validate } = {}) {
  for (; ;) {
    const suffix = def ? ` ${dim(`(${def})`)}` : '';
    const raw = await readLine(`${cyan('?')} ${question}${suffix} `);
    if (raw === null) throw new Error('input ended before setup finished');
    const answer = raw.trim() || def;
    if (!validate) return answer;
    const problem = validate(answer);
    if (!problem) return answer;
    console.log(red(`  ${problem}`));
  }
}

async function yesNo(question, def = true) {
  const answer = await ask(`${question} ${dim(def ? '[Y/n]' : '[y/N]')}`);
  if (!answer) return def;
  return /^y/i.test(answer);
}

async function choose(question, options) {
  console.log(`\n${bold(question)}`);
  options.forEach((opt, i) => console.log(`  ${cyan(String(i + 1))}) ${opt}`));
  const n = await ask('Choose', {
    def: '1',
    validate: (v) =>
      /^\d+$/.test(v) && +v >= 1 && +v <= options.length
        ? null
        : `Enter a number between 1 and ${options.length}`,
  });
  return +n - 1;
}

function openInBrowser(url) {
  const cmd =
    process.platform === 'win32' ? `start "" "${url}"`
      : process.platform === 'darwin' ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => { }); // best effort — the URL is printed either way
}

// --- env-file helpers ----------------------------------------------------------

const secret = () => randomBytes(32).toString('hex');

function parseEnv(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

// A value counts as configured when it isn't blank or one of the placeholder
// shapes used by .env.example / this wizard. Mirrored in
// src/components/SetupChecklist.tsx.
function configured(value) {
  if (!value) return false;
  return !/REPLACE_ME|your-|\.\.\.$|\[YOUR-PASSWORD\]|localhost:5432\/dbname/.test(value);
}

// Every key this wizard manages, in the order they are written.
const TEMPLATE_KEYS = new Set([
  'DATABASE_URL', 'SUPABASE_SCHEMA',
  'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL', 'NEXT_PUBLIC_BETTER_AUTH_URL',
  'STRIPE_SECRET_KEY_TEST', 'STRIPE_SECRET_KEY_LIVE', 'STRIPE_SECRET_KEY_MANAGED_SANDBOX',
  'STRIPE_WEBHOOK_SECRET_TEST_CONNECTED', 'STRIPE_WEBHOOK_SECRET_LIVE_CONNECTED',
  'STRIPE_WEBHOOK_SECRET_MANAGED_SANDBOX_CONNECTED',
  'STRIPE_WEBHOOK_SECRET_TEST_ACCOUNT', 'STRIPE_WEBHOOK_SECRET_LIVE_ACCOUNT',
  'STRIPE_BILLING_SECRET_KEY_LIVE', 'STRIPE_BILLING_SECRET_KEY_TEST',
  'STRIPE_BILLING_WEBHOOK_SECRET_LIVE', 'STRIPE_BILLING_WEBHOOK_SECRET_TEST',
  'STRIPE_APP_SIGNING_SECRET',
  'BEARER_TOKEN_KEYS', 'CRON_SECRET', 'DEV_API_KEY', 'URL_TOKEN_SECRET',
  'NODE_ENV',
]);

function buildEnv(v, extras) {
  // Required keys get a REPLACE_ME placeholder when unset (the checklist at
  // http://localhost:3000 flags them); optional keys stay commented out.
  const req = (key, placeholder) => `${key}=${v[key] !== undefined ? v[key] : placeholder}`;
  const opt = (key, placeholder) =>
    v[key] !== undefined ? `${key}=${v[key]}` : `# ${key}=${placeholder}`;

  let out = `# ============================================================================
#  Environment variables — written by delete_me_after_setup/setup.mjs
#  See .env.example for full documentation of every variable.
#  REPLACE_ME values still need filling in; http://localhost:3000 shows a
#  live checklist of what is missing while the setup folder exists.
# ============================================================================

# --- Database (Supabase Postgres — Better Auth connects here directly) -------
${req('DATABASE_URL', 'postgresql://REPLACE_ME')}
# Optional: install the tables into a dedicated schema instead of public —
# reuse a Supabase project you already have without burning a free-tier
# project slot. \`npm run db:setup\` creates it; you must also add it to
# "Exposed schemas" in the dashboard (Settings → API).
${opt('SUPABASE_SCHEMA', 'stripe_app')}

# --- Supabase API keys (the backend's data access goes through supabase-js) --
${req('NEXT_PUBLIC_SUPABASE_URL', 'https://REPLACE_ME.supabase.co')}
${req('SUPABASE_SERVICE_ROLE_KEY', 'REPLACE_ME')}
${opt('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'REPLACE_ME')}

# --- Better Auth --------------------------------------------------------------
${req('BETTER_AUTH_SECRET', 'REPLACE_ME')}
${req('BETTER_AUTH_URL', 'http://localhost:3000')}
${req('NEXT_PUBLIC_BETTER_AUTH_URL', 'http://localhost:3000')}

# --- Stripe (see src/lib/stripe.ts for the 2-accounts x 3-environments model) -
${req('STRIPE_SECRET_KEY_TEST', 'sk_test_REPLACE_ME')}
${req('STRIPE_SECRET_KEY_LIVE', 'sk_live_REPLACE_ME')}
${req('STRIPE_SECRET_KEY_MANAGED_SANDBOX', 'sk_test_REPLACE_ME')}

# For local dev: run \`stripe listen --forward-to localhost:3000/api/stripe/webhook\`
# and put the printed whsec_... into STRIPE_WEBHOOK_SECRET_TEST_CONNECTED.
${req('STRIPE_WEBHOOK_SECRET_TEST_CONNECTED', 'whsec_REPLACE_ME')}
${req('STRIPE_WEBHOOK_SECRET_LIVE_CONNECTED', 'whsec_REPLACE_ME')}
${req('STRIPE_WEBHOOK_SECRET_MANAGED_SANDBOX_CONNECTED', 'whsec_REPLACE_ME')}
${opt('STRIPE_WEBHOOK_SECRET_TEST_ACCOUNT', 'whsec_...')}
${opt('STRIPE_WEBHOOK_SECRET_LIVE_ACCOUNT', 'whsec_...')}
${opt('STRIPE_BILLING_SECRET_KEY_LIVE', 'sk_live_...')}
${opt('STRIPE_BILLING_SECRET_KEY_TEST', 'sk_test_...')}
${opt('STRIPE_BILLING_WEBHOOK_SECRET_LIVE', 'whsec_...')}
${opt('STRIPE_BILLING_WEBHOOK_SECRET_TEST', 'whsec_...')}

# Signing secret from your app's page in the Stripe Developers Dashboard —
# it only exists after the first \`stripe apps upload\` (uploading is NOT
# publishing; the app stays private to your account, so upload freely).
${req('STRIPE_APP_SIGNING_SECRET', 'absec_REPLACE_ME')}

# --- Proxy auth (src/proxy.ts + src/lib/proxy-auth.ts) ------------------------
${req('BEARER_TOKEN_KEYS', 'REPLACE_ME')}
${req('CRON_SECRET', 'REPLACE_ME')}
${req('DEV_API_KEY', 'REPLACE_ME')}
${req('URL_TOKEN_SECRET', 'REPLACE_ME')}

# --- App ----------------------------------------------------------------------
# change to production when deploying to Vercel or other hosting
${req('NODE_ENV', 'development')}
`;

  if (extras.length > 0) {
    out += `\n# --- Values carried over from your previous .env.local -----------------------\n`;
    for (const [key, value] of extras) out += `${key}=${value}\n`;
  }
  return out;
}

// --- the wizard ----------------------------------------------------------------

async function main() {
  console.log(`
${bold('Stripe Apps community example — one-time setup')}
${dim(`Writes ${path.relative(process.cwd(), envPath) || envPath}. Nothing leaves your machine.`)}${dryRun ? yellow('\nDRY RUN — nothing will be written.') : ''}
`);

  // 1. Respect an existing .env.local.
  const existing = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, 'utf8')) : new Map();
  let keepExisting = true;
  if (existing.size > 0) {
    const pick = await choose('.env.local already exists. What should happen to it?', [
      'Keep existing values, only fill in what is missing (recommended)',
      'Start fresh (the old file is backed up first)',
      'Cancel',
    ]);
    if (pick === 2) {
      console.log('Nothing changed.');
      return;
    }
    keepExisting = pick === 0;
  }

  const v = {};
  if (keepExisting) {
    for (const [key, value] of existing) if (configured(value)) v[key] = value;
  }
  const have = (key) => configured(v[key]);

  // 2. Generate every random secret the backend needs — no openssl required.
  const generated = [];
  for (const key of ['BETTER_AUTH_SECRET', 'URL_TOKEN_SECRET', 'BEARER_TOKEN_KEYS', 'CRON_SECRET', 'DEV_API_KEY']) {
    if (!have(key)) {
      v[key] = secret();
      generated.push(key);
    }
  }
  console.log(
    generated.length > 0
      ? `${green('✔')} Generated random secrets: ${generated.join(', ')}`
      : `${green('✔')} All random secrets already set — kept as-is.`,
  );

  if (!have('BETTER_AUTH_URL')) v.BETTER_AUTH_URL = 'http://localhost:3000';
  if (!have('NEXT_PUBLIC_BETTER_AUTH_URL')) v.NEXT_PUBLIC_BETTER_AUTH_URL = 'http://localhost:3000';
  if (!have('NODE_ENV')) v.NODE_ENV = 'development';

  // 3. Database.
  if (have('DATABASE_URL')) {
    console.log(`${green('✔')} DATABASE_URL already set — kept as-is.`);
  } else {
    const pick = await choose('Where is your Postgres database? (Supabase free tier works)', [
      'I already have a Supabase project — paste its connection string',
      "I don't have one — help me create a free Supabase project",
      'Skip for now (writes a placeholder)',
    ]);
    if (pick === 1) {
      console.log(`
  1. Sign in at Supabase ${cyan('https://database.new')} — it drops you straight into a Supabase "new project"
  2. Pick any name and region, set a ${bold('database password')} and keep it handy
  3. Wait a couple of minutes while the project provisions
`);
      if (await yesNo('Open https://database.new in your browser now?')) {
        openInBrowser('https://database.new');
      }
    }
    if (pick === 0 || pick === 1) {
      console.log(`
  In the Supabase dashboard, click ${bold('Connect')} in the top toolbar and copy a
  connection string. ${bold('Session pooler')} is the safest default — it works on
  IPv4-only networks and with every command in this repo.
`);
      let url = await ask('Paste the connection string', {
        validate: (s) =>
          /^postgres(ql)?:\/\//.test(s) ? null : 'That does not look like a postgres:// URL',
      });
      if (url.includes('[YOUR-PASSWORD]')) {
        const pw = await ask('It still contains [YOUR-PASSWORD] — enter your database password');
        url = url.replace('[YOUR-PASSWORD]', encodeURIComponent(pw));
      }
      if (/:6543\//.test(url)) {
        console.log(
          yellow(
            '  Note: port 6543 is the transaction pooler. If anything fails to connect,\n' +
            '  copy the session pooler (port 5432) connection string instead.',
          ),
        );
      }
      v.DATABASE_URL = url;
    } else {
      console.log(dim('  Skipped — the checklist at http://localhost:3000 will remind you.'));
    }
  }

  // 4. Supabase API keys — the backend's data access goes through supabase-js.
  if (have('NEXT_PUBLIC_SUPABASE_URL') && have('SUPABASE_SERVICE_ROLE_KEY')) {
    console.log(`${green('✔')} Supabase API keys already set — kept as-is.`);
  } else if (
    await yesNo('Add your Supabase API keys now? (dashboard → Project Settings → API Keys)')
  ) {
    v.NEXT_PUBLIC_SUPABASE_URL = await ask('Project URL (https://....supabase.co)', {
      def: v.NEXT_PUBLIC_SUPABASE_URL,
      validate: (s) => (/^https:\/\//.test(s) ? null : 'That does not look like an https:// URL'),
    });
    v.SUPABASE_SERVICE_ROLE_KEY = await ask('service_role secret key', {
      def: v.SUPABASE_SERVICE_ROLE_KEY,
      validate: (s) => (s ? null : 'Paste the service_role key (it stays on your machine)'),
    });
  } else {
    console.log(dim('  Skipped — the checklist at http://localhost:3000 will remind you.'));
  }

  // 5. public schema, or a dedicated one on a shared project?
  if (have('SUPABASE_SCHEMA')) {
    console.log(`${green('✔')} SUPABASE_SCHEMA already set to "${v.SUPABASE_SCHEMA}" — kept as-is.`);
  } else {
    const pick = await choose('Which Postgres schema should the tables live in?', [
      'public — the default, simplest choice',
      "A dedicated schema — reuse a Supabase project you already have (doesn't use up a free-tier project slot)",
    ]);
    if (pick === 1) {
      v.SUPABASE_SCHEMA = await ask('Schema name', {
        def: 'stripe_app',
        validate: (s) =>
          /^[a-z_][a-z0-9_]*$/.test(s)
            ? null
            : 'Lowercase letters, digits and _ only, starting with a letter',
      });
      console.log(dim('  npm run db:setup creates the schema and its tables automatically.'));
      console.log(
        yellow(
          `  One manual step: in the Supabase dashboard, open Settings → API and add\n  "${v.SUPABASE_SCHEMA}" to "Exposed schemas" — the backend can't query it until then.`,
        ),
      );
    }
  }

  // 6. Stripe test key (the only Stripe value needed for local development).
  if (have('STRIPE_SECRET_KEY_TEST')) {
    console.log(`${green('✔')} STRIPE_SECRET_KEY_TEST already set — kept as-is.`);
  } else if (await yesNo('Add your Stripe test-mode secret key now? (You can paste it later)')) {
    if (await yesNo('Open https://dashboard.stripe.com/test/apikeys in your browser?')) {
      openInBrowser('https://dashboard.stripe.com/test/apikeys');
    }
    v.STRIPE_SECRET_KEY_TEST = await ask('Paste the test secret key (sk_test_...)', {
      validate: (s) =>
        /^(sk|rk)_test_/.test(s)
          ? null
          : 'Test secret keys start with sk_test_ (or rk_test_ for restricted keys)',
    });
  }

  // 7. Write the file (or show it).
  const extras = [...existing].filter(([key, value]) => !TEMPLATE_KEYS.has(key) && configured(value));
  const content = buildEnv(v, extras);

  if (dryRun) {
    console.log(`\n${dim('--- .env.local (dry run — not written) ---')}\n`);
    console.log(content);
  } else {
    if (fs.existsSync(envPath)) {
      const backup = `${envPath}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      fs.copyFileSync(envPath, backup);
      console.log(`${green('✔')} Backed up the old file to ${path.basename(backup)}`);
    }
    fs.writeFileSync(envPath, content);
    console.log(`${green('✔')} Wrote ${path.relative(process.cwd(), envPath) || envPath}`);
  }

  // 8. Create the tables.
  if (!dryRun && have('DATABASE_URL')) {
    if (await yesNo('Create the database tables now? (runs `npm run db:setup`, which applies setup.sql)')) {
      const res = spawnSync('npm run db:setup', { cwd: backendDir, stdio: 'inherit', shell: true });
      console.log(
        res.status === 0
          ? green('✔ Tables created.')
          : red('✖ db:setup failed — see the output above. Rerun any time with `npm run db:setup`,\n  or paste nextjs-backend/setup.sql into the Supabase SQL editor instead.'),
      );
    }
  }

  // 9. What's left.
  const todo = [];
  if (!have('DATABASE_URL')) todo.push('Set DATABASE_URL in nextjs-backend/.env.local, then run `npm run db:setup`');
  if (!have('NEXT_PUBLIC_SUPABASE_URL') || !have('SUPABASE_SERVICE_ROLE_KEY'))
    todo.push('Copy the project URL and service_role key (Project Settings → API Keys)\n    into NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  if (have('SUPABASE_SCHEMA'))
    todo.push(
      `Add "${v.SUPABASE_SCHEMA}" to "Exposed schemas" in the Supabase dashboard\n    (Settings → API) — the checklist verifies this once tables exist`,
    );
  if (!have('STRIPE_SECRET_KEY_TEST')) todo.push('Paste your Stripe test key into STRIPE_SECRET_KEY_TEST');
  todo.push(
    'Local webhooks: `stripe listen --forward-to localhost:3000/api/stripe/webhook`\n    → copy the printed whsec_ into STRIPE_WEBHOOK_SECRET_TEST_CONNECTED',
  );
  todo.push(
    'After your first `npm run stripe:upload`: copy the app "Signing secret" from the\n    Stripe Developers Dashboard into STRIPE_APP_SIGNING_SECRET',
  );

  console.log(`\n${bold('Next steps')}`);
  for (const t of todo) console.log(`  ${yellow('•')} ${t}`);
  console.log(`
  Start everything with ${cyan('npm run dev')} — ${cyan('http://localhost:3000')} shows a live
  setup checklist covering all of the above.

  ${bold('When the checklist is green, delete nextjs-backend/delete_me_after_setup/')}
  ${dim('That removes this wizard, the install banner and the checklist — none of it is needed at runtime.')}
`);
}

main()
  .catch((err) => {
    // stdin closing mid-question (Ctrl+D / piped input running out) lands here.
    console.error(red(`\nSetup did not finish: ${err?.message ?? err}`));
    process.exitCode = 1;
  })
  .finally(() => rl.close());

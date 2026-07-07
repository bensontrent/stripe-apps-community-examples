// Creates every table the backend expects by running setup.sql against
// DATABASE_URL from .env.local.
//
// Run via `npm run db:setup` (from the repo root or nextjs-backend/).
// Alternative: paste setup.sql into the Supabase SQL editor and run it there.
//
// Set SUPABASE_SCHEMA in .env.local to install everything into a dedicated
// schema instead of `public` — handy for reusing a Supabase project you
// already have without burning a free-tier project slot. This script then
// creates the schema, installs the tables there, and grants Supabase's API
// roles access. One manual step remains: add the schema to "Exposed schemas"
// in the Supabase dashboard (Settings → API) so supabase-js can query it.
//
// `npm run db:setup -- --print` prints the (schema-qualified) SQL instead of
// running it — paste that into the SQL editor if you prefer.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(root, '.env.local') });

const printOnly = process.argv.includes('--print');
const schema = process.env.SUPABASE_SCHEMA || 'public';

if (!/^[a-z_][a-z0-9_]*$/.test(schema)) {
  console.error(
    `SUPABASE_SCHEMA "${schema}" is not a valid schema name — use lowercase letters, digits and _ only, starting with a letter.`,
  );
  process.exit(1);
}

let sql = readFileSync(join(root, 'setup.sql'), 'utf8');

if (schema !== 'public') {
  // setup.sql targets `public`: unqualified CREATE TABLEs follow search_path,
  // and the FK statements name "public" explicitly — point both at the
  // dedicated schema instead.
  sql = [
    `CREATE SCHEMA IF NOT EXISTS "${schema}";`,
    `SET search_path TO "${schema}";`,
    '',
    sql.replaceAll('"public"', `"${schema}"`),
    '',
    `-- Supabase's REST API roles need to reach the new schema. service_role does`,
    `-- the backend's actual work; anon/authenticated get USAGE only and RLS (no`,
    `-- policies) keeps them out of every table.`,
    `GRANT USAGE ON SCHEMA "${schema}" TO anon, authenticated, service_role;`,
    `GRANT ALL ON ALL TABLES IN SCHEMA "${schema}" TO service_role;`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA "${schema}" GRANT ALL ON TABLES TO service_role;`,
    '',
  ].join('\n');
}

if (printOnly) {
  console.log(sql);
  process.exit(0);
}

if (!process.env.DATABASE_URL || /REPLACE_ME|localhost:5432\/dbname/.test(process.env.DATABASE_URL)) {
  console.error('DATABASE_URL is not set in nextjs-backend/.env.local — run `npm run setup` first.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  // One multi-statement query runs in a single implicit transaction:
  // either every table is created, or none are.
  await client.query(sql);
  console.log(`setup.sql applied — all tables created in schema "${schema}".`);
  if (schema !== 'public') {
    console.log(
      `\nOne manual step left: in the Supabase dashboard, open Settings → API and add\n"${schema}" to "Exposed schemas" — supabase-js can't query the schema until then.`,
    );
  }
} catch (err) {
  if (err.code === '42P07') {
    console.error(`Tables already exist (${err.message}) — nothing was changed.`);
  } else {
    console.error(`Failed to apply setup.sql: ${err.message}`);
  }
  process.exitCode = 1;
} finally {
  await client.end();
}

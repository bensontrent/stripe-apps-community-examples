// scripts/db-setup.mjs — creates every table the backend expects by running
// setup.sql against the database.
//
//   npm run db:setup              apply setup.sql (no-op if the tables exist)
//   npm run db:setup -- --print   print the (schema-qualified) SQL instead —
//                                 paste it into the Supabase SQL editor
//
// Where the connection string comes from (first match wins, see env.mjs):
//   DATABASE_URL           your own Supabase project, set in .env.local by
//                          `npm run setup` (Session pooler string)
//   SUPABASE_POOLER_URL    written to .env when Supabase was provisioned with
//                          `stripe projects add supabase/project`
//   SUPABASE_DB_URL        ditto (direct connection; IPv6-only on Supabase)
//
// Set SUPABASE_SCHEMA to install everything into a dedicated schema instead
// of `public` — handy for reusing a Supabase project you already have. This
// script then creates the schema, installs the tables there, and grants
// Supabase's API roles access. One manual step remains: add the schema to
// "Exposed schemas" in the Supabase dashboard (Settings → API) so supabase-js
// can query it.
//
// `npm run setup` calls ensureTables() from here, so you rarely need to run
// this directly.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { isConfigured, loadEnv } from './env.mjs';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function isValidSchemaName(schema) {
  return /^[a-z_][a-z0-9_]*$/.test(schema);
}

/** setup.sql, wrapped in the CREATE SCHEMA / GRANT statements a dedicated schema needs. */
export function buildSql(schema) {
  const sql = readFileSync(join(root, 'setup.sql'), 'utf8');
  if (schema === 'public') return sql;
  // Every statement in setup.sql is schema-unqualified (including the inline
  // REFERENCES clauses), so pointing search_path at the dedicated schema is
  // all it takes to install everything there.
  return [
    `CREATE SCHEMA IF NOT EXISTS "${schema}";`,
    `SET search_path TO "${schema}";`,
    '',
    sql,
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

/**
 * Create the tables unless they already exist.
 * Resolves to 'created' or 'exists'; throws on connection/SQL errors.
 */
export async function ensureTables({ connectionString, schema }) {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    const { rows } = await client.query(
      `select 1 from information_schema.tables where table_schema = $1 and table_name = 'users'`,
      [schema],
    );
    if (rows.length > 0) return 'exists';
    // One multi-statement query runs in a single implicit transaction:
    // either every table is created, or none are.
    await client.query(buildSql(schema));
    return 'created';
  } finally {
    await client.end();
  }
}

async function main() {
  const printOnly = process.argv.includes('--print');
  const sources = loadEnv(root);
  const schema = process.env.SUPABASE_SCHEMA || 'public';

  if (!isValidSchemaName(schema)) {
    console.error(
      `SUPABASE_SCHEMA "${schema}" is not a valid schema name — use lowercase letters, digits and _ only, starting with a letter.`,
    );
    process.exit(1);
  }

  if (printOnly) {
    console.log(buildSql(schema));
    return;
  }

  if (!isConfigured(process.env.DATABASE_URL)) {
    console.error(
      'No database connection string found — run `npm run setup` first (it asks for DATABASE_URL),\n' +
        'or `stripe projects env --pull` if Supabase was provisioned with Stripe Projects.',
    );
    process.exit(1);
  }

  try {
    const result = await ensureTables({ connectionString: process.env.DATABASE_URL, schema });
    const from = sources.DATABASE_URL === 'DATABASE_URL' ? '' : ` (via ${sources.DATABASE_URL})`;
    console.log(
      result === 'created'
        ? `setup.sql applied — all tables created in schema "${schema}"${from}.`
        : `Tables already exist in schema "${schema}"${from} — nothing changed.`,
    );
    if (schema !== 'public') {
      console.log(
        `\nOne manual step left: in the Supabase dashboard, open Settings → API and add\n"${schema}" to "Exposed schemas" — supabase-js can't query the schema until then.`,
      );
    }
  } catch (err) {
    console.error(`Failed to apply setup.sql: ${err.message}`);
    process.exitCode = 1;
  }
}

// Run main() only when invoked directly (`node scripts/db-setup.mjs`), not
// when setup.mjs imports ensureTables().
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

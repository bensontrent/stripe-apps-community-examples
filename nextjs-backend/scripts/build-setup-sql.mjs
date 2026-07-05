// Builds setup.sql from the drizzle migration files.
// Run via `npm run db:generate` (chained) or directly: `node scripts/build-setup-sql.mjs`
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const drizzleDir = join(root, 'drizzle');

// Journal lists migrations in apply order; fall back to filename sort.
let order;
try {
  const journal = JSON.parse(readFileSync(join(drizzleDir, 'meta', '_journal.json'), 'utf8'));
  order = journal.entries.map((e) => `${e.tag}.sql`);
} catch {
  order = readdirSync(drizzleDir).filter((f) => f.endsWith('.sql')).sort();
}

const sql = order
  .map((file) => readFileSync(join(drizzleDir, file), 'utf8'))
  .join('\n')
  .replaceAll('--> statement-breakpoint', '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const header = `-- setup.sql — creates every table the backend expects.
-- Paste into the Supabase SQL editor (or run: psql "$DATABASE_URL" -f setup.sql)
-- as an alternative to \`npm run db:push\`.
--
-- GENERATED FILE — do not edit by hand.
-- Regenerate after any change to src/db/schema.ts by running: npm run db:generate
-- (drizzle-kit writes a migration, then this file is rebuilt from all migrations)

`;

writeFileSync(join(root, 'setup.sql'), header + sql + '\n');
console.log(`setup.sql rebuilt from ${order.length} migration(s): ${order.join(', ')}`);

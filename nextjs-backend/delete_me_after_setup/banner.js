/* eslint-disable @typescript-eslint/no-require-imports */
// Friendly first-run reminder, printed after `npm install` and before
// `npm run dev` by hooks in the root package.json. Those hooks wrap the
// require in try/catch, so deleting this folder silently disables the
// banner — that is the point of the folder name.
'use strict';

if (process.stdout.isTTY) {
  const fs = require('fs');
  const path = require('path');

  const backendDir = path.dirname(__dirname);
  const hasEnv = fs.existsSync(path.join(backendDir, '.env.local'));

  const bold = (s) => `\x1b[1m${s}\x1b[0m`;
  const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
  const rule = yellow('  ────────────────────────────────────────────────────────────────');

  const lines = hasEnv
    ? [
      `${bold('Setup:')} .env.local found. When the checklist at http://localhost:3030`,
      `is all green, delete ${bold('nextjs-backend/delete_me_after_setup/')} to remove`,
      'this message.',
    ]
    : [
      bold('First-time setup has not run yet. From the repo root, run:'),
      '',
      `      ${bold('npm run setup')}`,
      '',
      'It generates every secret, connects your Supabase database and writes',
      'nextjs-backend/.env.local. (Deleting nextjs-backend/delete_me_after_setup/',
      'silences this message.)',
    ];

  console.log('');
  console.log(rule);
  for (const l of lines) console.log(`  ${l}`);
  console.log(rule);
  console.log('');
}

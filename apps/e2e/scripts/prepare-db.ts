/**
 * Resets the throwaway E2E database: wipes `.tmp/` and applies every real
 * migration (raw-SQL ones included, e.g. the FTS5 search index) via
 * `drizzle-kit migrate` — `db:push` only diffs `schema.ts` and would skip
 * hand-written SQL migrations that don't have a Drizzle-schema equivalent.
 */

import { mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { DATABASE_URL, MEDIA_DIR, ROOT, TMP_DIR } from '../env.js';

rmSync(TMP_DIR, { recursive: true, force: true });
mkdirSync(MEDIA_DIR, { recursive: true });

const result = spawnSync('pnpm', ['--filter', '@ferrocms/db', 'db:migrate'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, DATABASE_URL },
});

if (result.status !== 0) {
  throw new Error(`Failed to prepare the E2E database (exit code ${result.status}).`);
}

console.log(`E2E database ready at ${DATABASE_URL}`);

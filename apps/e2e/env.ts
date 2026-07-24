/** Shared constants for the throwaway E2E environment — ports, paths, env vars. */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Monorepo root — where `pnpm --filter <pkg> <script>` needs to run from. */
export const ROOT = path.resolve(__dirname, '..', '..');

export const TMP_DIR = path.join(__dirname, '.tmp');
export const DB_PATH = path.join(TMP_DIR, 'e2e.db');
export const MEDIA_DIR = path.join(TMP_DIR, 'media');

export const API_PORT = 8799;
export const ADMIN_PORT = 5199;

/**
 * `file:` — a local, throwaway libSQL database file, not a Turso account.
 * Only the Node entry point's local client (see apps/api/src/node.ts) can
 * open this; it's never sent to the Cloudflare Workers-compatible client.
 */
export const DATABASE_URL = `file:${DB_PATH}`;

export const API_ENV: Record<string, string> = {
  DATABASE_URL,
  AUTH_SECRET: 'e2e-test-secret-do-not-use-in-production',
  ADMIN_ORIGIN: `http://localhost:${ADMIN_PORT}`,
  CORS_ORIGINS: `http://localhost:${ADMIN_PORT}`,
  MEDIA_DIR,
  PORT: String(API_PORT),
};

export const ADMIN_ENV: Record<string, string> = {
  VITE_API_URL: `http://localhost:${API_PORT}`,
};

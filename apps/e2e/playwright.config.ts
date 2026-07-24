import { defineConfig, devices } from '@playwright/test';
import { ADMIN_ENV, ADMIN_PORT, API_ENV, API_PORT, ROOT } from './env.js';

/** `process.env` types every value as possibly-`undefined`; webServer.env doesn't accept that. */
function cleanEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${ADMIN_PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @ferrocms/api start:node',
      cwd: ROOT,
      url: `http://localhost:${API_PORT}/health`,
      env: { ...cleanEnv(process.env), ...API_ENV },
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `pnpm --filter @ferrocms/admin exec vite --port ${ADMIN_PORT} --strictPort`,
      cwd: ROOT,
      url: `http://localhost:${ADMIN_PORT}`,
      env: { ...cleanEnv(process.env), ...ADMIN_ENV },
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

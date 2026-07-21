import { defineConfig } from 'drizzle-kit';

// `generate` works offline; `push`/`migrate` need a real Turso URL + token.
const url = process.env.DATABASE_URL ?? 'file:local.db';
const authToken = process.env.DATABASE_AUTH_TOKEN;

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'turso',
  dbCredentials: { url, authToken },
  strict: true,
  verbose: true,
});

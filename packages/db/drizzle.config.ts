import { defineConfig } from 'drizzle-kit';

// `generate` works offline from the schema; `push`/`migrate` need a real URL.
// Fall back to a placeholder so offline commands (and CI schema checks) work.
const url = process.env.DATABASE_URL ?? 'postgresql://placeholder/placeholder';

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});

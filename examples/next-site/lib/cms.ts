import { createClient } from '@ferrocms/sdk';

/**
 * Point this at your running FerroCMS instance — the Node runtime
 * (`pnpm --filter @ferrocms/api start:node`) or a deployed Worker both work,
 * since the API is identical either way.
 */
const FERROCMS_URL = process.env.NEXT_PUBLIC_FERROCMS_URL ?? 'http://localhost:8787';

export const cms = createClient({ url: FERROCMS_URL });

/**
 * Copies the parts of a FerroCMS checkout that make up a runnable project
 * (the API worker, the admin SPA, and the packages they depend on) into a new
 * project directory. Deliberately excludes repo-only concerns that don't
 * belong in a consumer's own project: the docs site, the Next.js example, and
 * OSS-hygiene files (LICENSE/CONTRIBUTING/SECURITY) that describe the
 * FerroCMS project itself, not the thing being scaffolded.
 */

import { access, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Directories copied wholesale (minus build artifacts) from the source checkout. */
export const TEMPLATE_DIRS = [
  'apps/api',
  'apps/admin',
  'packages/core',
  'packages/db',
  'packages/sdk',
];

/** Root-level files copied as-is. */
export const TEMPLATE_FILES = [
  'pnpm-workspace.yaml',
  'turbo.json',
  'tsconfig.base.json',
  'eslint.config.mjs',
  '.env.example',
  '.gitignore',
];

/** Build artifacts / caches that should never be copied, even if present in the source. */
const EXCLUDED_BASENAMES = new Set([
  'node_modules',
  'dist',
  '.turbo',
  '.wrangler',
  'coverage',
  '.dev.vars',
]);

function shouldCopy(srcPath: string): boolean {
  const base = path.basename(srcPath);
  return !EXCLUDED_BASENAMES.has(base) && !base.endsWith('.tsbuildinfo');
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function copyTemplate(sourceRoot: string, targetDir: string): Promise<void> {
  await mkdir(targetDir, { recursive: true });

  for (const dir of TEMPLATE_DIRS) {
    const src = path.join(sourceRoot, dir);
    if (!(await exists(src))) {
      throw new Error(`Template source is missing "${dir}" — is ${sourceRoot} a FerroCMS checkout?`);
    }
    await cp(src, path.join(targetDir, dir), { recursive: true, filter: shouldCopy });
  }

  for (const file of TEMPLATE_FILES) {
    const src = path.join(sourceRoot, file);
    if (await exists(src)) {
      await cp(src, path.join(targetDir, file));
    }
  }
}

/** Copy the source repo's root `package.json`, renamed and trimmed to this project. */
export async function writeRootPackageJson(
  sourceRoot: string,
  targetDir: string,
  packageName: string,
): Promise<void> {
  const raw = await readFile(path.join(sourceRoot, 'package.json'), 'utf8');
  const pkg = JSON.parse(raw) as Record<string, unknown>;
  pkg.name = packageName;
  pkg.description = 'A FerroCMS-based content platform.';
  const scripts = pkg.scripts as Record<string, string>;
  scripts.build = 'turbo run build';
  await writeFile(path.join(targetDir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
}

export async function writeReadme(targetDir: string, packageName: string): Promise<void> {
  const content = `# ${packageName}

Scaffolded with \`create-ferrocms\` — a headless, Cloudflare-native CMS
(Hono API worker + React admin SPA, backed by libSQL/Turso).

## Quick start

\`\`\`bash
pnpm install
cp .env.example apps/api/.dev.vars     # add DATABASE_URL + DATABASE_AUTH_TOKEN + AUTH_SECRET
pnpm --filter @ferrocms/db db:push     # create tables on your Turso database
pnpm dev                               # runs the API worker + admin SPA
\`\`\`

Open the admin at **http://localhost:5173** and register the first admin account.

Define your content types in \`apps/api/src/config/collections.ts\` — see the
[FerroCMS docs](https://github.com/locateanup/FerroCMS/tree/main/apps/docs/docs) for the full guide
(content modeling, API reference, deployment, plugin authoring).

Internal packages keep the \`@ferrocms/*\` scope regardless of this project's name — rename them with a
find-and-replace across \`apps/\`/\`packages/\` if you want a different scope.
`;
  await writeFile(path.join(targetDir, 'README.md'), content);
}

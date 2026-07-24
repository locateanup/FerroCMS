import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { scaffold } from './scaffold.js';
import { toPackageName, assertSafeDirName } from './validate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// packages/create-ferrocms/src -> repo root
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const cleanupDirs: string[] = [];

afterEach(async () => {
  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop()!;
    await rm(dir, { recursive: true, force: true });
  }
});

async function tempTarget(dirName = 'my-test-cms'): Promise<string> {
  const parent = await mkdtemp(path.join(tmpdir(), 'create-ferrocms-test-'));
  cleanupDirs.push(parent);
  return path.join(parent, dirName);
}

describe('toPackageName', () => {
  it('lowercases and hyphenates', () => {
    expect(toPackageName('My Cool CMS')).toBe('my-cool-cms');
  });

  it('falls back for an all-symbol name', () => {
    expect(toPackageName('!!!')).toBe('my-ferrocms-app');
  });
});

describe('assertSafeDirName', () => {
  it('rejects a path separator', () => {
    expect(() => assertSafeDirName('../evil')).toThrow();
    expect(() => assertSafeDirName('a/b')).toThrow();
  });

  it('accepts a plain name', () => {
    expect(() => assertSafeDirName('my-cms')).not.toThrow();
  });
});

describe('scaffold (against this repo checkout as the template source)', () => {
  it('copies the runnable packages and rewrites the root package.json', async () => {
    const targetDir = await tempTarget();

    const result = await scaffold({
      targetDir,
      sourceDir: REPO_ROOT,
    });

    expect(result.packageName).toBe('my-test-cms');

    // Runnable pieces present.
    await expect(stat(path.join(targetDir, 'apps/api/src/app.ts'))).resolves.toBeDefined();
    await expect(stat(path.join(targetDir, 'apps/admin/src'))).resolves.toBeDefined();
    await expect(stat(path.join(targetDir, 'packages/core/src/index.ts'))).resolves.toBeDefined();
    await expect(stat(path.join(targetDir, 'packages/db/src/schema.ts'))).resolves.toBeDefined();
    await expect(stat(path.join(targetDir, 'packages/sdk/src/index.ts'))).resolves.toBeDefined();

    // Root config files present.
    await expect(stat(path.join(targetDir, 'pnpm-workspace.yaml'))).resolves.toBeDefined();
    await expect(stat(path.join(targetDir, 'turbo.json'))).resolves.toBeDefined();
    await expect(stat(path.join(targetDir, '.env.example'))).resolves.toBeDefined();

    // Repo-only files excluded.
    await expect(stat(path.join(targetDir, 'apps/docs'))).rejects.toThrow();
    await expect(stat(path.join(targetDir, 'examples'))).rejects.toThrow();
    await expect(stat(path.join(targetDir, 'LICENSE'))).rejects.toThrow();

    // Build artifacts excluded even though they may exist in the source checkout.
    await expect(stat(path.join(targetDir, 'packages/core/dist'))).rejects.toThrow();
    await expect(stat(path.join(targetDir, 'apps/api/node_modules'))).rejects.toThrow();

    // Root package.json rewritten, internal package names untouched.
    const pkg = JSON.parse(await readFile(path.join(targetDir, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('my-test-cms');
    expect(pkg.scripts.build).toBe('turbo run build');
    const apiPkg = JSON.parse(await readFile(path.join(targetDir, 'apps/api/package.json'), 'utf8'));
    expect(apiPkg.name).toBe('@ferrocms/api');

    const readme = await readFile(path.join(targetDir, 'README.md'), 'utf8');
    expect(readme).toContain('my-test-cms');

    const migrations = await readdir(path.join(targetDir, 'packages/db/migrations'));
    expect(migrations.length).toBeGreaterThan(0);
  });

  it('refuses to scaffold into an existing directory', async () => {
    const targetDir = await tempTarget('dup');
    await scaffold({ targetDir, sourceDir: REPO_ROOT });

    await expect(scaffold({ targetDir, sourceDir: REPO_ROOT })).rejects.toThrow(/already exists/);
  });

  it('refuses to scaffold into a directory inside the template source', async () => {
    const targetDir = path.join(REPO_ROOT, 'packages', 'create-ferrocms', '__scaffold_test_tmp__');
    await expect(scaffold({ targetDir, sourceDir: REPO_ROOT })).rejects.toThrow(
      /inside the template source/,
    );
  });
});

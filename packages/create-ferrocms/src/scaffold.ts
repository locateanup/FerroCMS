import { access } from 'node:fs/promises';
import path from 'node:path';
import { copyTemplate, writeReadme, writeRootPackageJson } from './template.js';
import { fetchTemplate } from './fetchTemplate.js';
import { assertSafeDirName, toPackageName } from './validate.js';

export interface ScaffoldOptions {
  /** Where to create the project. May be relative or absolute; any path the caller can write to. */
  targetDir: string;
  /**
   * Use an already-checked-out FerroCMS repo instead of downloading one.
   * Mainly for testing create-ferrocms itself against a local checkout.
   */
  sourceDir?: string;
  /** Git ref to download when `sourceDir` isn't given. Defaults to "main". */
  ref?: string;
}

export interface ScaffoldResult {
  targetDir: string;
  packageName: string;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function scaffold(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const targetDir = path.resolve(options.targetDir);
  const dirName = path.basename(targetDir);
  assertSafeDirName(dirName);

  if (await exists(targetDir)) {
    throw new Error(`"${targetDir}" already exists — choose a different name or remove it.`);
  }

  if (options.sourceDir) {
    const resolvedSource = path.resolve(options.sourceDir);
    const relative = path.relative(resolvedSource, targetDir);
    if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
      throw new Error(`Target directory can't be inside the template source (${resolvedSource}).`);
    }
  }

  const packageName = toPackageName(dirName);

  let sourceRoot = options.sourceDir;
  let cleanup: (() => Promise<void>) | undefined;
  if (!sourceRoot) {
    const fetched = await fetchTemplate(options.ref ?? 'main');
    sourceRoot = fetched.root;
    cleanup = fetched.cleanup;
  }

  try {
    await copyTemplate(sourceRoot, options.targetDir);
    await writeRootPackageJson(sourceRoot, options.targetDir, packageName);
    await writeReadme(options.targetDir, packageName);
  } finally {
    await cleanup?.();
  }

  return { targetDir: options.targetDir, packageName };
}

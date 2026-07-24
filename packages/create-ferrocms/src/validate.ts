/** Directory-name safety check — the target folder create-ferrocms will write into. */
export function assertSafeDirName(name: string): void {
  if (!name || name === '.' || name === '..') {
    throw new Error('Please pass a project directory name, e.g. `create-ferrocms my-cms`.');
  }
  if (/[\\/]/.test(name)) {
    throw new Error(`Project name "${name}" must be a single directory name, not a path.`);
  }
}

/**
 * Derive an npm-safe package name for the scaffolded root `package.json` from
 * the (possibly free-form) directory name the user passed.
 */
export function toPackageName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'my-ferrocms-app';
}

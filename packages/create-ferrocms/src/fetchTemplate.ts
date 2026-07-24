/** Downloads the FerroCMS repo (a given ref) and extracts it to a temp directory. */

import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as tar from 'tar';

export interface FetchedTemplate {
  /** Path to the extracted repo root (e.g. `.../FerroCMS-main`). */
  root: string;
  /** Removes the temp directory the tarball was extracted into. */
  cleanup: () => Promise<void>;
}

export async function fetchTemplate(ref: string): Promise<FetchedTemplate> {
  const url = `https://github.com/locateanup/FerroCMS/archive/${encodeURIComponent(ref)}.tar.gz`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download FerroCMS template from ${url} (HTTP ${res.status}).`);
  }

  const dir = await mkdtemp(path.join(tmpdir(), 'create-ferrocms-'));
  const tarPath = path.join(dir, 'source.tar.gz');
  await writeFile(tarPath, Buffer.from(await res.arrayBuffer()));
  await tar.x({ file: tarPath, cwd: dir });
  await rm(tarPath);

  // GitHub codeload tarballs extract into a single top-level "<repo>-<ref>" directory.
  const entries = await readdir(dir);
  const rootEntry = entries[0];
  if (!rootEntry) {
    throw new Error(`Downloaded FerroCMS template from ${url} but the archive was empty.`);
  }

  return {
    root: path.join(dir, rootEntry),
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

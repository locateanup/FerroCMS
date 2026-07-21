/**
 * Lifecycle hooks — the seed of the plugin system (Phase 3).
 *
 * `beforeChange` hooks can transform or reject data before it is written.
 * `afterChange` / `afterDelete` hooks run side effects (webhooks, cache purge,
 * search indexing) after a successful write.
 */

import type { AccessUser } from './access.js';

export type EntryData = Record<string, unknown>;

export interface BeforeChangeArgs {
  operation: 'create' | 'update';
  data: EntryData;
  /** The existing entry on update, undefined on create. */
  existing?: EntryData;
  user: AccessUser | null;
}

export interface AfterChangeArgs {
  operation: 'create' | 'update';
  doc: EntryData;
  previous?: EntryData;
  user: AccessUser | null;
}

export interface DeleteArgs {
  id: string;
  doc: EntryData;
  user: AccessUser | null;
}

export type BeforeChangeHook = (args: BeforeChangeArgs) => EntryData | Promise<EntryData>;

export type AfterChangeHook = (args: AfterChangeArgs) => void | Promise<void>;

export type BeforeDeleteHook = (args: DeleteArgs) => void | Promise<void>;

export type AfterDeleteHook = (args: DeleteArgs) => void | Promise<void>;

export interface CollectionHooks {
  beforeChange?: BeforeChangeHook[];
  afterChange?: AfterChangeHook[];
  beforeDelete?: BeforeDeleteHook[];
  afterDelete?: AfterDeleteHook[];
}

/** Run beforeChange hooks in sequence, threading the transformed data. */
export async function runBeforeChange(
  hooks: BeforeChangeHook[] | undefined,
  args: BeforeChangeArgs,
): Promise<EntryData> {
  let data = args.data;
  for (const hook of hooks ?? []) {
    data = await hook({ ...args, data });
  }
  return data;
}

/** Run afterChange hooks in sequence (side effects only). */
export async function runAfterChange(
  hooks: AfterChangeHook[] | undefined,
  args: AfterChangeArgs,
): Promise<void> {
  for (const hook of hooks ?? []) {
    await hook(args);
  }
}

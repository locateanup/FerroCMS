/**
 * Role-based access control primitives.
 *
 * Access is always enforced server-side in the API — the admin UI only uses
 * these to decide what to show. Never trust the client.
 */

export const ROLES = ['admin', 'editor', 'author', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export type AccessOperation = 'create' | 'read' | 'update' | 'delete';

export interface AccessUser {
  id: string;
  role: Role;
}

export interface AccessArgs {
  /** The authenticated user, or null for anonymous/public requests. */
  user: AccessUser | null;
  /** The entry id being acted on, when relevant (update/delete/read-one). */
  id?: string;
}

export type AccessFn = (args: AccessArgs) => boolean;

export interface CollectionAccess {
  create?: AccessFn;
  read?: AccessFn;
  update?: AccessFn;
  delete?: AccessFn;
}

/**
 * Per-field access control. Omit either to inherit the collection's access
 * for that operation. Enforced server-side: unreadable fields are stripped
 * from responses, unwritable fields are stripped from incoming writes.
 */
export interface FieldAccess {
  read?: AccessFn;
  update?: AccessFn;
}

/** Rank roles so we can express "at least editor". */
const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  author: 1,
  editor: 2,
  admin: 3,
};

export function hasAtLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** Access helper: allow anyone (including anonymous). */
export const anyone: AccessFn = () => true;

/** Access helper: allow any authenticated user. */
export const authenticated: AccessFn = ({ user }) => user !== null;

/** Access helper: allow users whose role is at least `min`. */
export function atLeast(min: Role): AccessFn {
  return ({ user }) => user !== null && hasAtLeast(user.role, min);
}

/**
 * Default access for a collection when none is specified:
 * public can read, authenticated authors+ can write, editors+ can delete.
 */
export const defaultAccess: Required<CollectionAccess> = {
  read: anyone,
  create: atLeast('author'),
  update: atLeast('author'),
  delete: atLeast('editor'),
};

export function resolveAccess(access?: CollectionAccess): Required<CollectionAccess> {
  return {
    read: access?.read ?? defaultAccess.read,
    create: access?.create ?? defaultAccess.create,
    update: access?.update ?? defaultAccess.update,
    delete: access?.delete ?? defaultAccess.delete,
  };
}

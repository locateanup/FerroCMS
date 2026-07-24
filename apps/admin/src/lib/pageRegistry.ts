/**
 * A registry for custom admin *pages* — lets a plugin (or a fork's own
 * `plugins.ts`) add a whole route + nav entry to the admin, not just a field
 * renderer or field type. Registered pages render inside the normal
 * authenticated `<Layout>`, same as any built-in page.
 */

import type { ComponentType } from 'react';
import type { Role } from './types.js';

export interface AdminPage {
  /** Route path, e.g. '/tools/status' (mounted under the authenticated app). */
  path: string;
  /** Nav link label. */
  label: string;
  component: ComponentType;
  /** Minimum role required to see the nav link and reach the route. Default: any authenticated user. */
  minRole?: Role;
}

const ROLE_RANK: Record<Role, number> = { viewer: 0, author: 1, editor: 2, admin: 3 };

const registry: AdminPage[] = [];

/** Register a custom admin page. Call this from plugins.ts before the app renders. */
export function registerAdminPage(page: AdminPage): void {
  registry.push(page);
}

export function getAdminPages(): AdminPage[] {
  return registry;
}

export function canAccessPage(page: AdminPage, role: Role | undefined): boolean {
  if (!role) return false;
  if (!page.minRole) return true;
  return ROLE_RANK[role] >= ROLE_RANK[page.minRole];
}

export type Role = 'admin' | 'editor' | 'author' | 'viewer';
export type EntryStatus = 'draft' | 'published' | 'scheduled' | 'archived';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  totpEnabled: boolean;
}

export interface LoginChallenge {
  requiresTotp: true;
  challengeToken: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  active: boolean;
  totpEnabled: boolean;
  createdAt: string;
}

export interface GlobalSchema {
  slug: string;
  label: string;
  fields: Field[];
}

export interface GlobalEntry {
  id: string;
  collection: string;
  data: Record<string, unknown>;
  updatedAt: string;
}

export interface SearchHit {
  entryId: string;
  collection: string;
  title: string;
  snippet: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  collection: string | null;
  entryId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface Field {
  name: string;
  type:
    | 'text'
    | 'textarea'
    | 'slug'
    | 'number'
    | 'boolean'
    | 'date'
    | 'select'
    | 'json'
    | 'richText'
    | 'relation'
    | 'media'
    | 'taxonomy';
  label?: string;
  required?: boolean;
  description?: string;
  options?: SelectOption[];
  many?: boolean;
  from?: string;
  relationTo?: string;
  taxonomy?: string;
  localized?: boolean;
  admin?: {
    placeholder?: string;
    hidden?: boolean;
    width?: 'full' | 'half';
    help?: string;
    group?: string;
  };
}

export interface CollectionSchema {
  slug: string;
  labels: { singular: string; plural: string };
  fields: Field[];
  admin: { useAsTitle: string; icon?: string; defaultColumns?: string[] };
  drafts: boolean;
  timestamps: boolean;
  taxonomyConfig: { enabled: boolean; hierarchical: boolean };
  locales: string[];
  defaultLocale?: string;
}

export interface Entry {
  id: string;
  collection: string;
  status: EntryStatus;
  slug: string | null;
  data: Record<string, unknown>;
  authorId: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListResult {
  items: Entry[];
  total: number;
  limit: number;
  offset: number;
}

export interface MediaItem {
  id: string;
  key: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  folder: string | null;
  alt: string | null;
  createdAt: string;
}

export interface Revision {
  id: string;
  entryId: string;
  collection: string;
  status: EntryStatus;
  data: Record<string, unknown>;
  authorId: string | null;
  createdAt: string;
}

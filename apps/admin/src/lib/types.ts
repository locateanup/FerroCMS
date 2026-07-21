export type Role = 'admin' | 'editor' | 'author' | 'viewer';
export type EntryStatus = 'draft' | 'published' | 'scheduled' | 'archived';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
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
    | 'media';
  label?: string;
  required?: boolean;
  description?: string;
  options?: SelectOption[];
  many?: boolean;
  from?: string;
  admin?: { placeholder?: string; hidden?: boolean; width?: 'full' | 'half'; help?: string };
}

export interface CollectionSchema {
  slug: string;
  labels: { singular: string; plural: string };
  fields: Field[];
  admin: { useAsTitle: string; icon?: string; defaultColumns?: string[] };
  drafts: boolean;
  timestamps: boolean;
}

export interface Entry {
  id: string;
  collection: string;
  status: EntryStatus;
  slug: string | null;
  data: Record<string, unknown>;
  authorId: string | null;
  publishedAt: string | null;
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
  alt: string | null;
  createdAt: string;
}

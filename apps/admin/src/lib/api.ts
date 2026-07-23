import type {
  AdminUser,
  AuditLogEntry,
  CollectionSchema,
  Comment,
  Entry,
  EntryStatus,
  GlobalEntry,
  GlobalSchema,
  ListResult,
  LoginChallenge,
  MediaItem,
  Redirect,
  Revision,
  Role,
  SearchHit,
  User,
} from './types.js';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const isForm = init?.body instanceof FormData;
  if (!isForm && init?.body) headers.set('Content-Type', 'application/json');

  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...init, headers });
  if (res.status === 204) return undefined as T;

  const body = (await res.json().catch(() => null)) as
    { error?: { code?: string; message?: string; details?: unknown } } | T | null;

  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string; details?: unknown } } | null)
      ?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'error',
      err?.message ?? res.statusText,
      err?.details,
    );
  }
  return body as T;
}

export const api = {
  base: BASE,

  me: () => req<User>('/api/auth/me'),
  login: (email: string, password: string) =>
    req<User | LoginChallenge>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  completeTotpLogin: (challengeToken: string, token: string) =>
    req<User>('/api/auth/login/2fa', {
      method: 'POST',
      body: JSON.stringify({ challengeToken, token }),
    }),
  register: (email: string, password: string, name?: string) =>
    req<User>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
  logout: () => req<{ ok: true }>('/api/auth/logout', { method: 'POST' }),

  setup2fa: () =>
    req<{ secret: string; otpauthUrl: string }>('/api/auth/2fa/setup', { method: 'POST' }),
  verify2fa: (token: string) =>
    req<{ enabled: true }>('/api/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  disable2fa: (token: string) =>
    req<{ enabled: false }>('/api/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  collections: () => req<{ items: CollectionSchema[] }>('/api/collections'),

  listEntries: (
    slug: string,
    params: { status?: EntryStatus; limit?: number; offset?: number } = {},
  ) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.limit) q.set('limit', String(params.limit));
    if (params.offset) q.set('offset', String(params.offset));
    const qs = q.toString();
    return req<ListResult>(`/api/${slug}${qs ? `?${qs}` : ''}`);
  },
  getEntry: (slug: string, id: string) => req<Entry>(`/api/${slug}/${id}`),
  createEntry: (
    slug: string,
    data: Record<string, unknown>,
    status: EntryStatus,
    scheduledAt?: string | null,
  ) =>
    req<Entry>(`/api/${slug}`, {
      method: 'POST',
      body: JSON.stringify({ data, status, scheduledAt }),
    }),
  updateEntry: (
    slug: string,
    id: string,
    data: Record<string, unknown>,
    status: EntryStatus,
    scheduledAt?: string | null,
  ) =>
    req<Entry>(`/api/${slug}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ data, status, scheduledAt }),
    }),
  deleteEntry: (slug: string, id: string) => req<void>(`/api/${slug}/${id}`, { method: 'DELETE' }),

  listMedia: (folder?: string) =>
    req<{ items: MediaItem[] }>(
      `/api/media${folder ? `?folder=${encodeURIComponent(folder)}` : ''}`,
    ),
  uploadMedia: (file: File, opts: { alt?: string; folder?: string } = {}) => {
    const form = new FormData();
    form.set('file', file);
    if (opts.alt) form.set('alt', opts.alt);
    if (opts.folder) form.set('folder', opts.folder);
    return req<MediaItem>('/api/media', { method: 'POST', body: form });
  },
  deleteMedia: (id: string) => req<void>(`/api/media/${id}`, { method: 'DELETE' }),
  mediaUrl: (key: string) => `${BASE}/api/media/file/${key}`,

  listRevisions: (slug: string, id: string) =>
    req<{ items: Revision[] }>(`/api/${slug}/${id}/revisions`),
  restoreRevision: (slug: string, id: string, revisionId: string) =>
    req<Entry>(`/api/${slug}/${id}/revisions/${revisionId}/restore`, { method: 'POST' }),

  submitForReview: (slug: string, id: string) =>
    req<Entry>(`/api/${slug}/${id}/submit-for-review`, { method: 'POST' }),
  reviewEntry: (slug: string, id: string, approved: boolean, note?: string) =>
    req<Entry>(`/api/${slug}/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ approved, note }),
    }),
  listReviewQueue: () => req<{ items: Entry[] }>('/api/review/queue'),

  listUsers: () => req<{ items: AdminUser[] }>('/api/users'),
  createUser: (email: string, password: string, role: Role, name?: string) =>
    req<AdminUser>('/api/users', {
      method: 'POST',
      body: JSON.stringify({ email, password, role, name }),
    }),
  updateUser: (id: string, patch: { name?: string; role?: Role; active?: boolean }) =>
    req<AdminUser>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  search: (q: string) => req<{ items: SearchHit[] }>(`/api/search?q=${encodeURIComponent(q)}`),

  globals: () => req<{ items: GlobalSchema[] }>('/api/globals'),
  getGlobal: (slug: string) => req<GlobalEntry>(`/api/globals/${slug}`),
  updateGlobal: (slug: string, data: Record<string, unknown>) =>
    req<GlobalEntry>(`/api/globals/${slug}`, { method: 'PATCH', body: JSON.stringify({ data }) }),

  listRedirects: () => req<{ items: Redirect[] }>('/api/redirects'),
  createRedirect: (fromPath: string, toPath: string, statusCode: Redirect['statusCode']) =>
    req<Redirect>('/api/redirects', {
      method: 'POST',
      body: JSON.stringify({ fromPath, toPath, statusCode }),
    }),
  deleteRedirect: (id: string) => req<void>(`/api/redirects/${id}`, { method: 'DELETE' }),

  listPendingComments: () => req<{ items: Comment[] }>('/api/comments/pending'),
  approveComment: (id: string) => req<Comment>(`/api/comments/${id}`, { method: 'PATCH' }),
  deleteComment: (id: string) => req<void>(`/api/comments/${id}`, { method: 'DELETE' }),

  listAuditLog: (params: { limit?: number; offset?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.limit) q.set('limit', String(params.limit));
    if (params.offset) q.set('offset', String(params.offset));
    const qs = q.toString();
    return req<{ items: AuditLogEntry[] }>(`/api/audit-log${qs ? `?${qs}` : ''}`);
  },
};

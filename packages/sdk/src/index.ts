/**
 * @ferrocms/sdk — a tiny, dependency-free typed client for reading (and, with an
 * API key, writing) content from an FerroCMS instance. Works in the browser, in
 * Node, and in edge runtimes (anywhere `fetch` exists).
 */

export type EntryStatus = 'draft' | 'published' | 'scheduled' | 'archived';

export interface FerroCmsEntry<T = Record<string, unknown>> {
  id: string;
  collection: string;
  status: EntryStatus;
  slug: string | null;
  data: T;
  authorId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListResult<T> {
  items: FerroCmsEntry<T>[];
  total: number;
  limit: number;
  offset: number;
}

export interface FindOptions {
  status?: EntryStatus;
  slug?: string;
  limit?: number;
  offset?: number;
}

export interface ClientOptions {
  /** Base URL of the FerroCMS API, e.g. https://cms.example.com */
  url: string;
  /** Optional API key for authenticated reads (drafts) or writes. */
  apiKey?: string;
  /** Custom fetch implementation (defaults to global fetch). */
  fetch?: typeof fetch;
}

export class FerroCmsError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'FerroCmsError';
    this.status = status;
    this.code = code;
  }
}

export interface FerroCmsClient {
  find<T = Record<string, unknown>>(
    collection: string,
    options?: FindOptions,
  ): Promise<ListResult<T>>;
  findOne<T = Record<string, unknown>>(
    collection: string,
    id: string,
  ): Promise<FerroCmsEntry<T> | null>;
  findBySlug<T = Record<string, unknown>>(
    collection: string,
    slug: string,
  ): Promise<FerroCmsEntry<T> | null>;
  /** Build a public URL for a media object key. */
  mediaUrl(key: string): string;
}

export function createClient(options: ClientOptions): FerroCmsClient {
  const base = options.url.replace(/\/+$/, '');
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error('No fetch implementation available. Pass one via options.fetch.');
  }

  async function request<R>(path: string, init?: RequestInit): Promise<R> {
    const headers = new Headers(init?.headers);
    if (options.apiKey) headers.set('Authorization', `Bearer ${options.apiKey}`);
    const res = await fetchImpl(`${base}${path}`, { ...init, headers });

    if (res.status === 204) return undefined as R;
    const body = (await res.json().catch(() => null)) as
      { error?: { code?: string; message?: string } } | R | null;

    if (!res.ok) {
      const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
      throw new FerroCmsError(res.status, err?.code ?? 'error', err?.message ?? res.statusText);
    }
    return body as R;
  }

  function query(options: FindOptions): string {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status);
    if (options.slug) params.set('slug', options.slug);
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    if (options.offset !== undefined) params.set('offset', String(options.offset));
    const s = params.toString();
    return s ? `?${s}` : '';
  }

  return {
    find(collection, opts = {}) {
      return request(`/api/${encodeURIComponent(collection)}${query(opts)}`);
    },
    async findOne(collection, id) {
      try {
        return await request(`/api/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`);
      } catch (err) {
        if (err instanceof FerroCmsError && err.status === 404) return null;
        throw err;
      }
    },
    async findBySlug<T = Record<string, unknown>>(collection: string, slug: string) {
      const result = await this.find<T>(collection, { slug, limit: 1 });
      return result.items[0] ?? null;
    },
    mediaUrl(key) {
      return `${base}/api/media/file/${key}`;
    },
  };
}

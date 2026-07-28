/**
 * Meilisearch — a real third-party search integration, not just an adapter
 * interface with nothing behind it. Self-hostable and open-source (unlike
 * Algolia), so this is genuinely runnable without a paid account: install
 * Meilisearch yourself (https://www.meilisearch.com/docs/learn/getting_started/installation)
 * and set MEILISEARCH_URL (+ MEILISEARCH_API_KEY if you enabled one).
 *
 * This is deliberately NOT wired into the built-in `/api/search` route — the
 * built-in FTS5 search (services/search.ts) needs zero setup and stays the
 * default. This is an *optional* replacement/addition you wire yourself via
 * a plugin's `afterChange`/`afterDelete` hooks — see docs/plugins.md's
 * "Third-party integrations" section for the two-line example.
 */

export interface MeilisearchConfig {
  url: string;
  apiKey?: string;
}

export interface MeilisearchDocument {
  id: string;
  [key: string]: unknown;
}

async function request(
  config: MeilisearchConfig,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(`${config.url.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(
      `Meilisearch request to ${path} failed (HTTP ${res.status}): ${await res.text().catch(() => '')}`,
    );
  }
  return res;
}

/**
 * Upsert one document into an index. Meilisearch processes writes as an
 * async background task (returns a task id, not a completion guarantee) —
 * fine for a "keep search roughly in sync" use case, same fire-and-forget
 * posture as this project's webhooks/notifications.
 */
export async function indexDocument(
  config: MeilisearchConfig,
  indexUid: string,
  doc: MeilisearchDocument,
): Promise<void> {
  await request(config, `/indexes/${encodeURIComponent(indexUid)}/documents`, {
    method: 'POST',
    body: JSON.stringify([doc]),
  });
}

export async function removeDocument(
  config: MeilisearchConfig,
  indexUid: string,
  id: string,
): Promise<void> {
  await request(
    config,
    `/indexes/${encodeURIComponent(indexUid)}/documents/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  );
}

export interface MeilisearchHit extends MeilisearchDocument {
  _formatted?: MeilisearchDocument;
}

export async function searchIndex(
  config: MeilisearchConfig,
  indexUid: string,
  query: string,
  limit = 20,
): Promise<MeilisearchHit[]> {
  const res = await request(config, `/indexes/${encodeURIComponent(indexUid)}/search`, {
    method: 'POST',
    body: JSON.stringify({ q: query, limit }),
  });
  const body = (await res.json()) as { hits: MeilisearchHit[] };
  return body.hits;
}

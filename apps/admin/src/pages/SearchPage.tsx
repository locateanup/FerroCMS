import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api.js';
import { useCollections } from '../lib/collections.js';
import type { SearchHit } from '../lib/types.js';

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const { collections } = useCollections();
  const [items, setItems] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .search(q)
      .then((r) => setItems(r.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Search failed.'))
      .finally(() => setLoading(false));
  }, [q]);

  function labelFor(slug: string): string {
    return collections.find((c) => c.slug === slug)?.labels.singular ?? slug;
  }

  /** The snippet is raw entry text (not markup) with `[`/`]` around matches —
   * render highlights as real React nodes rather than dangerouslySetInnerHTML,
   * so a field value that happens to contain HTML can't inject into the page. */
  function renderSnippet(snippet: string) {
    let marked = false;
    return snippet
      .split(/(\[|\])/)
      .map((part, i) => {
        if (part === '[') {
          marked = true;
          return null;
        }
        if (part === ']') {
          marked = false;
          return null;
        }
        if (!part) return null;
        return marked ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>;
      })
      .filter(Boolean);
  }

  return (
    <>
      <div className="page-header">
        <h1>Search results for &quot;{q}&quot;</h1>
      </div>

      {error && (
        <div className="error-text" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="muted">Searching…</p>
      ) : items.length === 0 ? (
        <div className="card empty">No matches.</div>
      ) : (
        <div className="table">
          <div className="table-row table-head">
            <span>Title</span>
            <span>Collection</span>
            <span>Match</span>
          </div>
          {items.map((hit) => (
            <Link
              key={hit.entryId}
              to={`/collections/${hit.collection}/${hit.entryId}`}
              className="table-row clickable"
            >
              <span style={{ fontWeight: 500 }}>{hit.title || '(untitled)'}</span>
              <span className="muted">{labelFor(hit.collection)}</span>
              <span className="muted" style={{ fontSize: 12 }}>
                {renderSnippet(hit.snippet)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

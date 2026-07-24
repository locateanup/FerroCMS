import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api.js';
import type { Comment } from '../lib/types.js';

export function CommentsPage() {
  const [items, setItems] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    api
      .listPendingComments()
      .then((r) => setItems(r.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load comments.'))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function approve(id: string) {
    await api.approveComment(id);
    setItems((prev) => prev.filter((c) => c.id !== id));
  }

  async function reject(id: string) {
    await api.deleteComment(id);
    setItems((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <>
      <div className="page-header">
        <h1>Comments</h1>
        <span className="muted">{items.length} awaiting moderation</span>
      </div>

      {error && (
        <div className="error-text" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card empty">Nothing to moderate.</div>
      ) : (
        <div className="table">
          <div className="table-row table-head">
            <span>Author</span>
            <span>On</span>
            <span>Comment</span>
            <span></span>
          </div>
          {items.map((c) => (
            <div key={c.id} className="table-row">
              <span style={{ fontWeight: 500 }}>
                {c.authorName}
                {c.authorEmail && (
                  <div className="muted" style={{ fontSize: 11, fontWeight: 400 }}>
                    {c.authorEmail}
                  </div>
                )}
              </span>
              <span className="muted" style={{ fontSize: 12 }}>
                {c.collection}/{c.entryId.slice(0, 8)}
              </span>
              <span style={{ fontSize: 13 }}>{c.body}</span>
              <span className="row" style={{ gap: 6 }}>
                <button
                  className="btn btn-primary"
                  style={{ padding: '4px 8px', fontSize: 12 }}
                  onClick={() => approve(c.id)}
                >
                  Approve
                </button>
                <button
                  className="btn btn-danger"
                  style={{ padding: '4px 8px', fontSize: 12 }}
                  onClick={() => reject(c.id)}
                >
                  Reject
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

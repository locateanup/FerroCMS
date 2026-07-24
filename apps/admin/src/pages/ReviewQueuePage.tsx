import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api.js';
import { useCollections } from '../lib/collections.js';
import type { Entry } from '../lib/types.js';

export function ReviewQueuePage() {
  const { collections } = useCollections();
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    api
      .listReviewQueue()
      .then((r) => setItems(r.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load the review queue.'))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  function titleFor(entry: Entry): string {
    const collection = collections.find((c) => c.slug === entry.collection);
    const titleField = collection?.admin.useAsTitle ?? 'title';
    return String(entry.data[titleField] ?? '(untitled)');
  }

  async function decide(entry: Entry, approved: boolean) {
    setBusy(entry.id);
    try {
      await api.reviewEntry(entry.collection, entry.id, approved, approved ? undefined : notes[entry.id]);
      setItems((prev) => prev.filter((i) => i.id !== entry.id));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Review queue</h1>
        <span className="muted">{items.length} awaiting review</span>
      </div>

      {error && (
        <div className="error-text" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card empty">Nothing awaiting review.</div>
      ) : (
        items.map((entry) => (
          <div key={entry.id} className="card" style={{ marginBottom: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <Link
                  to={`/collections/${entry.collection}/${entry.id}`}
                  style={{ fontWeight: 500 }}
                >
                  {titleFor(entry)}
                </Link>
                <div className="muted" style={{ fontSize: 12 }}>
                  {entry.collection} ·{' '}
                  {entry.reviewRequestedAt
                    ? `submitted ${new Date(entry.reviewRequestedAt).toLocaleString()}`
                    : ''}
                </div>
              </div>
            </div>
            <textarea
              placeholder="Note for the author (only sent if you reject)"
              rows={2}
              value={notes[entry.id] ?? ''}
              onChange={(e) => setNotes((prev) => ({ ...prev, [entry.id]: e.target.value }))}
              style={{ marginBottom: 8 }}
            />
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn btn-primary"
                disabled={busy === entry.id}
                onClick={() => decide(entry, true)}
              >
                Approve &amp; publish
              </button>
              <button
                className="btn btn-danger"
                disabled={busy === entry.id}
                onClick={() => decide(entry, false)}
              >
                Reject
              </button>
            </div>
          </div>
        ))
      )}
    </>
  );
}

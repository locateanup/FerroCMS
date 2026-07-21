import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useCollection } from '../lib/collections.js';
import type { Entry } from '../lib/types.js';

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

export function CollectionListPage() {
  const { slug } = useParams<{ slug: string }>();
  const collection = useCollection(slug);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api
      .listEntries(slug, { limit: 100 })
      .then((r) => setEntries(r.items))
      .finally(() => setLoading(false));
  }, [slug]);

  const titleField = collection?.admin.useAsTitle ?? 'title';

  return (
    <>
      <div className="page-header">
        <h1>{collection?.labels.plural ?? slug}</h1>
        <span className="muted">{entries.length} entries</span>
        <div className="spacer" />
        <Link to={`/collections/${slug}/new`} className="btn btn-primary">
          + New
        </Link>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="card empty">No entries yet. Create the first one with “+ New”.</div>
      ) : (
        <div className="table">
          <div className="table-row table-head">
            <span>Title</span>
            <span>Slug</span>
            <span>Updated</span>
            <span>Status</span>
          </div>
          {entries.map((entry) => (
            <Link
              key={entry.id}
              to={`/collections/${slug}/${entry.id}`}
              className="table-row clickable"
            >
              <span style={{ fontWeight: 500 }}>
                {String(entry.data[titleField] ?? '(untitled)')}
              </span>
              <span className="muted">{entry.slug ?? '—'}</span>
              <span className="muted">{new Date(entry.updatedAt).toLocaleDateString()}</span>
              <span>
                <StatusBadge status={entry.status} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

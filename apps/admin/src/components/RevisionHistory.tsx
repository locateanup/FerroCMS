import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import type { Entry, Revision } from '../lib/types.js';

interface Props {
  slug: string;
  id: string;
  /** Called after a successful restore so the editor can reload the entry. */
  onRestored: (entry: Entry) => void;
}

export function RevisionHistory({ slug, id, onRestored }: Props) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  function refresh() {
    api
      .listRevisions(slug, id)
      .then((r) => setRevisions(r.items))
      .catch(() => setRevisions([]));
  }

  useEffect(refresh, [slug, id]);

  async function restore(revisionId: string) {
    if (
      !confirm(
        'Restore this version? Current content will be overwritten (and itself saved as a revision).',
      )
    ) {
      return;
    }
    setBusy(revisionId);
    try {
      const entry = await api.restoreRevision(slug, id, revisionId);
      onRestored(entry);
      refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
      <button
        className="btn"
        style={{ width: '100%', justifyContent: 'space-between' }}
        onClick={() => setOpen((v) => !v)}
      >
        <span>History ({revisions.length})</span>
        <span className="muted">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {revisions.length === 0 ? (
            <span className="muted" style={{ fontSize: 12 }}>
              No revisions yet.
            </span>
          ) : (
            revisions.map((rev, i) => (
              <div
                key={rev.id}
                className="row"
                style={{ justifyContent: 'space-between', fontSize: 12 }}
              >
                <span>
                  <span className={`badge badge-${rev.status}`}>{rev.status}</span>{' '}
                  <span className="muted">{new Date(rev.createdAt).toLocaleString()}</span>
                </span>
                {i === 0 ? (
                  <span className="muted">current</span>
                ) : (
                  <button
                    className="btn"
                    style={{ padding: '2px 8px', fontSize: 11 }}
                    disabled={busy !== null}
                    onClick={() => restore(rev.id)}
                  >
                    {busy === rev.id ? '…' : 'Restore'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

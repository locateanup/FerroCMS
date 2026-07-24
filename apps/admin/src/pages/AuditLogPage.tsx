import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api.js';
import type { AuditLogEntry } from '../lib/types.js';

const PAGE_SIZE = 50;

function describe(entry: AuditLogEntry): string {
  const target = entry.collection ? `${entry.collection}${entry.entryId ? `/${entry.entryId.slice(0, 8)}` : ''}` : null;
  return target ? `${entry.action} — ${target}` : entry.action;
}

export function AuditLogPage() {
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .listAuditLog({ limit: PAGE_SIZE, offset })
      .then((r) => setItems(r.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load audit log.'))
      .finally(() => setLoading(false));
  }, [offset]);

  return (
    <>
      <div className="page-header">
        <h1>Audit log</h1>
        <div className="spacer" />
        <button className="btn" disabled={offset === 0} onClick={() => setOffset(0)}>
          Newest
        </button>
        <button
          className="btn"
          disabled={items.length < PAGE_SIZE}
          onClick={() => setOffset((o) => o + PAGE_SIZE)}
        >
          Older →
        </button>
      </div>

      {error && (
        <div className="error-text" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card empty">Nothing logged yet.</div>
      ) : (
        <div className="table">
          <div className="table-row table-head">
            <span>When</span>
            <span>Action</span>
            <span>By</span>
            <span>Details</span>
          </div>
          {items.map((entry) => (
            <div key={entry.id} className="table-row">
              <span className="muted">{new Date(entry.createdAt).toLocaleString()}</span>
              <span style={{ fontWeight: 500 }}>{describe(entry)}</span>
              <span className="muted">{entry.userId ? entry.userId.slice(0, 8) : 'system'}</span>
              <span className="muted" style={{ fontSize: 12 }}>
                {entry.details ? JSON.stringify(entry.details) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

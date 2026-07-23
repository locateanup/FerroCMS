import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api.js';
import type { Redirect } from '../lib/types.js';

const STATUS_CODES: Redirect['statusCode'][] = [301, 302, 307, 308];

export function RedirectsPage() {
  const [items, setItems] = useState<Redirect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [fromPath, setFromPath] = useState('');
  const [toPath, setToPath] = useState('');
  const [statusCode, setStatusCode] = useState<Redirect['statusCode']>(301);
  const [busy, setBusy] = useState(false);

  function refresh() {
    setLoading(true);
    api
      .listRedirects()
      .then((r) => setItems(r.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load redirects.'))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function create() {
    setError(null);
    setBusy(true);
    try {
      await api.createRedirect(fromPath, toPath, statusCode);
      setFromPath('');
      setToPath('');
      setStatusCode(301);
      setShowForm(false);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create redirect.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this redirect?')) return;
    await api.deleteRedirect(id);
    setItems((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <>
      <div className="page-header">
        <h1>Redirects</h1>
        <span className="muted">{items.length} redirects</span>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ New redirect'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ maxWidth: 480, marginBottom: 16 }}>
          <label htmlFor="from-path">From path</label>
          <input
            id="from-path"
            placeholder="/old-url"
            value={fromPath}
            onChange={(e) => setFromPath(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <label htmlFor="to-path">To path</label>
          <input
            id="to-path"
            placeholder="/new-url"
            value={toPath}
            onChange={(e) => setToPath(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <label htmlFor="status-code">Status code</label>
          <select
            id="status-code"
            value={statusCode}
            onChange={(e) => setStatusCode(Number(e.target.value) as Redirect['statusCode'])}
            style={{ marginBottom: 8 }}
          >
            {STATUS_CODES.map((code) => (
              <option key={code} value={code}>
                {code} {code === 301 ? '(permanent)' : code === 302 ? '(temporary)' : ''}
              </option>
            ))}
          </select>
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-primary" disabled={busy || !fromPath || !toPath} onClick={create}>
            {busy ? 'Creating…' : 'Create redirect'}
          </button>
        </div>
      )}

      {!showForm && error && (
        <div className="error-text" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card empty">No redirects yet.</div>
      ) : (
        <div className="table">
          <div className="table-row table-head">
            <span>From</span>
            <span>To</span>
            <span>Status</span>
            <span></span>
          </div>
          {items.map((r) => (
            <div key={r.id} className="table-row">
              <span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: 13 }}>
                {r.fromPath}
              </span>
              <span className="muted" style={{ fontFamily: 'monospace', fontSize: 13 }}>
                {r.toPath}
              </span>
              <span className="muted">{r.statusCode}</span>
              <span>
                <button
                  className="btn btn-danger"
                  style={{ padding: '4px 8px', fontSize: 12 }}
                  onClick={() => remove(r.id)}
                >
                  Delete
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

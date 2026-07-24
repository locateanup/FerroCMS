import { useState } from 'react';
import { api } from '../lib/api.js';

/**
 * A minimal example of a plugin-registered custom admin page (see
 * ../plugins.ts) — not part of the core admin, just a demonstration that a
 * plugin can add a whole page + nav entry, not only a field renderer.
 */
export function SystemStatusPage() {
  const [result, setResult] = useState<{ status: string; service: string } | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${api.base}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
      setCheckedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Health check failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>System status</h1>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          A plugin-registered page (see <code>apps/admin/src/plugins.ts</code>) — pings the API's{' '}
          <code>/health</code> endpoint.
        </p>
        {result && (
          <div style={{ marginBottom: 12 }}>
            <span className="badge badge-published">{result.status}</span>
            <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
              {result.service}
            </span>
          </div>
        )}
        {checkedAt && (
          <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
            Last checked {checkedAt.toLocaleTimeString()}
          </div>
        )}
        {error && <div className="error-text">{error}</div>}
        <button className="btn btn-primary" disabled={busy} onClick={check}>
          {busy ? 'Checking…' : 'Check now'}
        </button>
      </div>
    </>
  );
}

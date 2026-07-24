import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api.js';
import type { FormSchema } from '../lib/types.js';

export function FormsPage() {
  const [items, setItems] = useState<FormSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .forms()
      .then((r) => setItems(r.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load forms.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>Forms</h1>
        <span className="muted">{items.length} forms</span>
      </div>

      {error && (
        <div className="error-text" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card empty">No forms configured.</div>
      ) : (
        <div className="table">
          <div className="table-row table-head">
            <span>Name</span>
            <span>Fields</span>
          </div>
          {items.map((f) => (
            <Link key={f.slug} to={`/forms/${f.slug}`} className="table-row clickable">
              <span style={{ fontWeight: 500 }}>{f.name}</span>
              <span className="muted">{f.fields.map((field) => field.label ?? field.name).join(', ')}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

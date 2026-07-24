import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api.js';
import type { FormSubmission } from '../lib/types.js';

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(columns: string[], rows: FormSubmission[]): string {
  const header = columns.map(csvCell).join(',');
  const lines = rows.map((row) =>
    columns.map((col) => csvCell(col === 'createdAt' ? row.createdAt : row.data[col])).join(','),
  );
  return [header, ...lines].join('\n');
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function FormSubmissionsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [items, setItems] = useState<FormSubmission[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    Promise.all([api.listFormSubmissions(slug), api.forms()])
      .then(([subs, formsResult]) => {
        setItems(subs.items);
        const form = formsResult.items.find((f) => f.slug === slug);
        setColumns(form ? form.fields.map((f) => f.name) : []);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load submissions.'))
      .finally(() => setLoading(false));
  }, [slug]);

  async function remove(id: string) {
    if (!slug || !confirm('Delete this submission?')) return;
    await api.deleteFormSubmission(slug, id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function exportCsv() {
    if (!slug) return;
    download(`${slug}-submissions.csv`, toCsv([...columns, 'createdAt'], items));
  }

  return (
    <>
      <div className="page-header">
        <h1>{slug} submissions</h1>
        <span className="muted">{items.length} submissions</span>
        <div className="spacer" />
        <button className="btn" disabled={items.length === 0} onClick={exportCsv}>
          Export CSV
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
        <div className="card empty">No submissions yet.</div>
      ) : (
        <div className="table">
          <div className="table-row table-head">
            {columns.map((col) => (
              <span key={col}>{col}</span>
            ))}
            <span>Submitted</span>
            <span></span>
          </div>
          {items.map((item) => (
            <div key={item.id} className="table-row">
              {columns.map((col) => (
                <span key={col} style={{ fontSize: 13 }}>
                  {String(item.data[col] ?? '')}
                </span>
              ))}
              <span className="muted" style={{ fontSize: 12 }}>
                {new Date(item.createdAt).toLocaleString()}
              </span>
              <span>
                <button
                  className="btn btn-danger"
                  style={{ padding: '4px 8px', fontSize: 12 }}
                  onClick={() => remove(item.id)}
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

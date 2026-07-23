import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api.js';
import { useGlobal } from '../lib/globals.js';
import { FieldInput } from '../components/FieldInput.js';

export function GlobalEditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const global = useGlobal(slug);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api
      .getGlobal(slug)
      .then((entry) => setData(entry.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (!slug) return null;

  function setField(name: string, value: unknown) {
    setData((prev) => ({ ...prev, [name]: value }));
    setDirty(true);
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.updateGlobal(slug!, data);
      setDirty(false);
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        const details = err.details as { path: string; message: string }[];
        setError(details.map((d) => `${d.path}: ${d.message}`).join(', '));
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to save.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <>
      <div className="page-header">
        <h1>{global?.label ?? slug}</h1>
        <div className="spacer" />
        {dirty && (
          <span className="muted" style={{ fontSize: 12, marginRight: 8 }}>
            unsaved
          </span>
        )}
        {saved && !dirty && (
          <span className="muted" style={{ fontSize: 12, marginRight: 8 }}>
            saved
          </span>
        )}
        <button className="btn btn-primary" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        {global ? (
          global.fields.map((field) => (
            <FieldInput
              key={field.name}
              field={field}
              value={data[field.name]}
              onChange={(v) => setField(field.name, v)}
            />
          ))
        ) : (
          <p className="muted">Unknown global.</p>
        )}
        {error && <div className="error-text">{error}</div>}
      </div>
    </>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api.js';
import { useCollection } from '../lib/collections.js';
import { FieldInput } from '../components/FieldInput.js';
import type { EntryStatus } from '../lib/types.js';

export function EntryEditorPage() {
  const { slug, id } = useParams<{ slug: string; id?: string }>();
  const collection = useCollection(slug);
  const navigate = useNavigate();

  const isNew = !id || id === 'new';
  const [data, setData] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState<EntryStatus>('draft');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !slug || !id) return;
    setLoading(true);
    api
      .getEntry(slug, id)
      .then((entry) => {
        setData(entry.data);
        setStatus(entry.status);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }, [slug, id, isNew]);

  if (!slug) return null;

  function setField(name: string, value: unknown) {
    setData((prev) => ({ ...prev, [name]: value }));
    setDirty(true);
  }

  async function save(nextStatus: EntryStatus) {
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const created = await api.createEntry(slug!, data, nextStatus);
        navigate(`/collections/${slug}/${created.id}`, { replace: true });
      } else {
        await api.updateEntry(slug!, id!, data, nextStatus);
        setStatus(nextStatus);
      }
      setDirty(false);
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

  async function remove() {
    if (isNew || !confirm('Delete this entry? This cannot be undone.')) return;
    await api.deleteEntry(slug!, id!);
    navigate(`/collections/${slug}`);
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <>
      <div className="page-header">
        <h1>
          {isNew ? 'New' : 'Edit'} {collection?.labels.singular ?? slug}
        </h1>
        <div className="spacer" />
        {!isNew && (
          <button className="btn btn-danger" onClick={remove}>
            Delete
          </button>
        )}
      </div>

      <div className="editor-layout">
        <div className="card">
          {collection ? (
            collection.fields.map((field, i) => {
              const group = field.admin?.group;
              const prevGroup = i > 0 ? collection.fields[i - 1]?.admin?.group : undefined;
              const showHeader = group && group !== prevGroup;
              return (
                <div key={field.name}>
                  {showHeader && (
                    <div
                      style={{
                        margin: '8px 0 12px',
                        paddingTop: 16,
                        borderTop: '1px solid var(--border)',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {group}
                    </div>
                  )}
                  <FieldInput
                    field={field}
                    value={data[field.name]}
                    onChange={(v) => setField(field.name, v)}
                  />
                </div>
              );
            })
          ) : (
            <p className="muted">Unknown collection.</p>
          )}
          {error && <div className="error-text">{error}</div>}
        </div>

        <aside className="card" style={{ alignSelf: 'start' }}>
          <label>Status</label>
          <div style={{ marginBottom: 12 }}>
            <span className={`badge badge-${status}`}>{status}</span>
            {dirty && (
              <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                unsaved
              </span>
            )}
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
            disabled={saving}
            onClick={() => save('published')}
          >
            {saving ? 'Saving…' : 'Publish'}
          </button>
          <button
            className="btn"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={saving}
            onClick={() => save('draft')}
          >
            Save draft
          </button>
        </aside>
      </div>
    </>
  );
}

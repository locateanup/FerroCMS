import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api.js';
import { useCollection } from '../lib/collections.js';
import type { Entry, EntryStatus } from '../lib/types.js';

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

const BULK_STATUSES: EntryStatus[] = ['draft', 'published', 'archived'];

export function CollectionListPage() {
  const { slug } = useParams<{ slug: string }>();
  const collection = useCollection(slug);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<EntryStatus>('published');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  function refresh() {
    if (!slug) return;
    setLoading(true);
    api
      .listEntries(slug, { limit: 100 })
      .then((r) => setEntries(r.items))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [slug]);

  const titleField = collection?.admin.useAsTitle ?? 'title';
  const allSelected = entries.length > 0 && selected.size === entries.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(entries.map((e) => e.id)));
  }

  async function applyBulkStatus() {
    if (!slug || selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      await api.bulkUpdateStatus(slug, [...selected], bulkStatus);
      setSelected(new Set());
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Bulk update failed.');
    } finally {
      setBusy(false);
    }
  }

  async function bulkDelete() {
    if (!slug || selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} entries? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.bulkDelete(slug, [...selected]);
      setSelected(new Set());
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Bulk delete failed.');
    } finally {
      setBusy(false);
    }
  }

  async function exportJson() {
    if (!slug) return;
    const result = await api.exportEntries(slug);
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { items?: Array<{ data: Record<string, unknown>; status?: EntryStatus }> };
      if (!slug || !Array.isArray(parsed.items)) throw new Error('Expected a JSON file with an "items" array.');
      const result = await api.importEntries(slug, parsed.items);
      if (result.failed.length > 0) {
        setError(`Imported ${result.created.length}, ${result.failed.length} row(s) failed.`);
      }
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>{collection?.labels.plural ?? slug}</h1>
        <span className="muted">{entries.length} entries</span>
        <div className="spacer" />
        <input
          ref={importRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importJson(file);
            e.target.value = '';
          }}
        />
        <button className="btn" disabled={busy} onClick={() => importRef.current?.click()}>
          Import
        </button>
        <button className="btn" onClick={exportJson}>
          Export
        </button>
        <Link to={`/collections/${slug}/new`} className="btn btn-primary">
          + New
        </Link>
      </div>

      {error && (
        <div className="error-text" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {selected.size > 0 && (
        <div className="card row" style={{ gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 13 }}>
            {selected.size} selected
          </span>
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as EntryStatus)}>
            {BULK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" disabled={busy} onClick={applyBulkStatus}>
            Apply
          </button>
          <button className="btn btn-danger" disabled={busy} onClick={bulkDelete}>
            Delete selected
          </button>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="card empty">No entries yet. Create the first one with “+ New”.</div>
      ) : (
        <div className="table">
          <div className="table-row table-head">
            <span>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ width: 'auto' }} />
            </span>
            <span>Title</span>
            <span>Slug</span>
            <span>Updated</span>
            <span>Status</span>
          </div>
          {entries.map((entry) => (
            <div key={entry.id} className="table-row">
              <span>
                <input
                  type="checkbox"
                  checked={selected.has(entry.id)}
                  onChange={() => toggle(entry.id)}
                  style={{ width: 'auto' }}
                />
              </span>
              <Link to={`/collections/${slug}/${entry.id}`} style={{ fontWeight: 500 }}>
                {String(entry.data[titleField] ?? '(untitled)')}
              </Link>
              <span className="muted">{entry.slug ?? '—'}</span>
              <span className="muted">{new Date(entry.updatedAt).toLocaleDateString()}</span>
              <span>
                <StatusBadge status={entry.status} />
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

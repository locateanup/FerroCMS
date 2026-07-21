import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api.js';
import type { MediaItem } from '../lib/types.js';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function refresh() {
    setLoading(true);
    api
      .listMedia()
      .then((r) => setItems(r.items))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      await api.uploadMedia(file);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this file?')) return;
    await api.deleteMedia(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <>
      <div className="page-header">
        <h1>Media</h1>
        <div className="spacer" />
        <input
          ref={fileRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = '';
          }}
        />
        <button
          className="btn btn-primary"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? 'Uploading…' : 'Upload'}
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
        <div className="card empty">No files yet. Upload one to get started.</div>
      ) : (
        <div className="media-grid">
          {items.map((item) => (
            <div key={item.id} className="media-tile">
              {item.mimeType.startsWith('image/') ? (
                <img src={api.mediaUrl(item.key)} alt={item.alt ?? item.filename} />
              ) : (
                <div
                  style={{
                    height: 110,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  className="muted"
                >
                  {item.mimeType}
                </div>
              )}
              <div className="meta">
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.filename}
                </div>
                <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
                  <span className="muted">{formatSize(item.size)}</span>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '2px 6px', fontSize: 11 }}
                    onClick={() => remove(item.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import type { MediaItem } from '../lib/types.js';

interface Props {
  value: unknown;
  onChange: (value: unknown) => void;
}

/** Picker for `media` fields — stores the R2 object key so the front-end can
 *  build a URL directly via the SDK's `mediaUrl(key)`. */
export function MediaInput({ value, onChange }: Props) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const key = typeof value === 'string' ? value : '';

  useEffect(() => {
    api
      .listMedia()
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, []);

  const selected = items.find((i) => i.key === key);

  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: 'var(--surface-2)',
        }}
      >
        {key && selected?.mimeType.startsWith('image/') ? (
          <img
            src={api.mediaUrl(key)}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span className="muted" style={{ fontSize: 11 }}>
            none
          </span>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <select value={key} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">— none —</option>
          {items.map((item) => (
            <option key={item.id} value={item.key}>
              {item.filename}
            </option>
          ))}
        </select>
        {key && (
          <button
            className="btn"
            style={{ marginTop: 8, padding: '4px 10px', fontSize: 12 }}
            onClick={() => onChange(undefined)}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

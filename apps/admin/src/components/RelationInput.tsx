import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useCollection } from '../lib/collections.js';
import type { Entry, Field } from '../lib/types.js';

interface Props {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
}

/** Picker for `relation` fields — selects entries from the related collection. */
export function RelationInput({ field, value, onChange }: Props) {
  const target = field.relationTo;
  const targetCollection = useCollection(target);
  const [options, setOptions] = useState<Entry[]>([]);

  useEffect(() => {
    if (!target) return;
    api
      .listEntries(target, { limit: 100 })
      .then((r) => setOptions(r.items))
      .catch(() => setOptions([]));
  }, [target]);

  const titleField = targetCollection?.admin.useAsTitle ?? 'title';
  const label = (entry: Entry) => String(entry.data[titleField] ?? entry.id.slice(0, 8));

  if (field.many) {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <select
        multiple
        value={selected}
        onChange={(e) => onChange(Array.from(e.target.selectedOptions).map((o) => o.value))}
        style={{ minHeight: 90 }}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {label(o)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <select
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {label(o)}
        </option>
      ))}
    </select>
  );
}

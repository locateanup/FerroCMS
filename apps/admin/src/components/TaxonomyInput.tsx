import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useCollection } from '../lib/collections.js';
import type { Entry, Field } from '../lib/types.js';

interface Props {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
}

interface TreeNode {
  entry: Entry;
  depth: number;
}

/** Order terms as a depth-first hierarchy (roots first, then children indented). */
function buildTree(entries: Entry[], titleField: string): TreeNode[] {
  const byParent = new Map<string, Entry[]>();
  const roots: Entry[] = [];
  for (const entry of entries) {
    const parent = typeof entry.data.parent === 'string' ? entry.data.parent : undefined;
    if (parent) {
      const siblings = byParent.get(parent) ?? [];
      siblings.push(entry);
      byParent.set(parent, siblings);
    } else {
      roots.push(entry);
    }
  }
  const label = (e: Entry) => String(e.data[titleField] ?? '');
  const byLabel = (a: Entry, b: Entry) => label(a).localeCompare(label(b));

  const result: TreeNode[] = [];
  const seen = new Set<string>();
  function visit(entry: Entry, depth: number) {
    if (seen.has(entry.id)) return; // guard against cyclical parents
    seen.add(entry.id);
    result.push({ entry, depth });
    for (const child of (byParent.get(entry.id) ?? []).slice().sort(byLabel)) {
      visit(child, depth + 1);
    }
  }
  for (const root of roots.slice().sort(byLabel)) visit(root, 0);
  // Terms whose parent id doesn't resolve to another term (dangling ref) still show up.
  for (const entry of entries) if (!seen.has(entry.id)) visit(entry, 0);
  return result;
}

/** Picker for `taxonomy` fields — assigns terms from a taxonomy collection, hierarchy-aware. */
export function TaxonomyInput({ field, value, onChange }: Props) {
  const taxonomySlug = field.taxonomy;
  const taxonomyCollection = useCollection(taxonomySlug);
  const [terms, setTerms] = useState<Entry[]>([]);

  useEffect(() => {
    if (!taxonomySlug) return;
    api
      .listEntries(taxonomySlug, { limit: 200 })
      .then((r) => setTerms(r.items))
      .catch(() => setTerms([]));
  }, [taxonomySlug]);

  const titleField = taxonomyCollection?.admin.useAsTitle ?? 'name';
  const tree = useMemo(() => buildTree(terms, titleField), [terms, titleField]);
  const many = field.many !== false;

  if (many) {
    const selected = new Set(Array.isArray(value) ? (value as string[]) : []);
    function toggle(id: string) {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange(Array.from(next));
    }
    return (
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 8,
          maxHeight: 220,
          overflowY: 'auto',
        }}
      >
        {tree.length === 0 ? (
          <span className="muted" style={{ fontSize: 12 }}>
            No terms yet — create some in {taxonomyCollection?.labels.plural ?? taxonomySlug}.
          </span>
        ) : (
          tree.map(({ entry, depth }) => (
            <label
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                paddingLeft: depth * 16,
                fontSize: 13,
                padding: '3px 0',
              }}
            >
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={selected.has(entry.id)}
                onChange={() => toggle(entry.id)}
              />
              <span>{String(entry.data[titleField] ?? entry.id.slice(0, 8))}</span>
            </label>
          ))
        )}
      </div>
    );
  }

  return (
    <select
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      <option value="">—</option>
      {tree.map(({ entry, depth }) => (
        <option key={entry.id} value={entry.id}>
          {'— '.repeat(depth)}
          {String(entry.data[titleField] ?? entry.id.slice(0, 8))}
        </option>
      ))}
    </select>
  );
}

import { evaluateCondition } from '@ferrocms/core';
import type { Field } from '../lib/types.js';
import { getFieldRenderer } from '../lib/fieldRegistry.js';
import { reorder, useDragReorder } from '../lib/dragReorder.js';
import { RelationInput } from './RelationInput.js';
import { MediaInput } from './MediaInput.js';
import { BlockEditor } from './BlockEditor.js';
import { TaxonomyInput } from './TaxonomyInput.js';

interface Props {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  /**
   * The data object this field's siblings live on — the whole entry for a
   * top-level field, or just the enclosing group/repeater row for a nested
   * one. Used to evaluate `admin.condition` against sibling values.
   */
  formData?: Record<string, unknown>;
  /**
   * Validation messages keyed by dot-path from the entry root (matching the
   * server's zod issue paths, e.g. "pillar" or "faq.0.question") — see
   * EntryEditorPage's save(). Passed through unchanged at every nesting
   * level; each FieldInput just looks up its own `path`.
   */
  errors?: Record<string, string>;
  /** This field's own dot-path from the entry root. Defaults to field.name
   * for a top-level field; group/repeater cases below pass the nested path
   * down explicitly. */
  path?: string;
}

function label(field: Field): string {
  return field.label ?? field.name.charAt(0).toUpperCase() + field.name.slice(1);
}

export function FieldInput({ field, value, onChange, formData = {}, errors, path }: Props) {
  // Called unconditionally regardless of field.type (Rules of Hooks) — cheap
  // when unused, only wired up in the 'repeater' case below.
  const repeaterRows = field.type === 'repeater' && Array.isArray(value) ? value : [];
  const { dragIndex, handleProps, dropZoneProps } = useDragReorder((from, to) =>
    onChange(reorder(repeaterRows, from, to)),
  );

  if (field.admin?.hidden) return null;
  if (field.admin?.condition && !evaluateCondition(field.admin.condition, formData)) return null;

  const fieldPath = path ?? field.name;
  const error = errors?.[fieldPath];
  const common = { id: field.name, placeholder: field.admin?.placeholder };

  return (
    <div className={`field${error ? ' field-invalid' : ''}`}>
      <label htmlFor={field.name}>
        {label(field)}
        {field.required ? ' *' : ''}
      </label>
      {renderControl()}
      {error ? (
        <div className="field-error" role="alert">
          {error}
        </div>
      ) : field.description ? (
        <div className="help">{field.description}</div>
      ) : null}
    </div>
  );

  function renderControl() {
    const Custom = getFieldRenderer(field.type);
    if (Custom) return <Custom field={field} value={value} onChange={onChange} />;

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            {...common}
            rows={3}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case 'richText':
        return <BlockEditor value={value} onChange={onChange} />;
      case 'number':
        return (
          <input
            {...common}
            type="number"
            value={value === undefined || value === null ? '' : Number(value)}
            onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          />
        );
      case 'boolean':
        return (
          <div className="row">
            <input
              id={field.name}
              type="checkbox"
              style={{ width: 'auto' }}
              checked={value === true}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span className="muted">{value ? 'Yes' : 'No'}</span>
          </div>
        );
      case 'date':
        return (
          <input
            {...common}
            type="date"
            value={typeof value === 'string' ? value.slice(0, 10) : ''}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case 'select':
        return (
          <select
            id={field.name}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value || undefined)}
          >
            <option value="">—</option>
            {(field.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );
      case 'json':
        return (
          <textarea
            {...common}
            rows={4}
            value={value === undefined ? '' : JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                onChange(e.target.value === '' ? undefined : JSON.parse(e.target.value));
              } catch {
                /* keep typing; invalid JSON is ignored until valid */
              }
            }}
          />
        );
      case 'relation':
        return <RelationInput field={field} value={value} onChange={onChange} />;
      case 'media':
        return <MediaInput value={value} onChange={onChange} />;
      case 'taxonomy':
        return <TaxonomyInput field={field} value={value} onChange={onChange} />;
      case 'group': {
        const groupValue = (value as Record<string, unknown>) ?? {};
        return (
          <div className="card" style={{ padding: 12 }}>
            {(field.fields ?? []).map((sub) => (
              <FieldInput
                key={sub.name}
                field={sub}
                value={groupValue[sub.name]}
                formData={groupValue}
                errors={errors}
                path={`${fieldPath}.${sub.name}`}
                onChange={(v) => onChange({ ...groupValue, [sub.name]: v })}
              />
            ))}
          </div>
        );
      }
      case 'repeater': {
        const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
        const min = field.minRows ?? 0;
        const max = field.maxRows;
        return (
          <div>
            {rows.map((row, i) => (
              <div
                key={i}
                className="card"
                {...dropZoneProps(i)}
                style={{
                  padding: 12,
                  marginBottom: 8,
                  position: 'relative',
                  opacity: dragIndex === i ? 0.5 : 1,
                }}
              >
                <span
                  {...handleProps(i)}
                  className="muted"
                  title="Drag to reorder"
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    cursor: 'grab',
                    fontSize: 14,
                  }}
                >
                  ⠿
                </span>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    padding: '2px 8px',
                    fontSize: 11,
                  }}
                  disabled={rows.length <= min}
                  onClick={() => onChange(rows.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
                <div style={{ marginTop: 20 }} />
                {(field.fields ?? []).map((sub) => (
                  <FieldInput
                    key={sub.name}
                    field={sub}
                    value={row[sub.name]}
                    formData={row}
                    errors={errors}
                    path={`${fieldPath}.${i}.${sub.name}`}
                    onChange={(v) =>
                      onChange(rows.map((r, j) => (j === i ? { ...r, [sub.name]: v } : r)))
                    }
                  />
                ))}
              </div>
            ))}
            <button
              type="button"
              className="btn"
              disabled={max !== undefined && rows.length >= max}
              onClick={() => onChange([...rows, {}])}
            >
              + Add {label(field).replace(/s$/, '')}
            </button>
          </div>
        );
      }
      default:
        // text, slug
        return (
          <input
            {...common}
            type="text"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
          />
        );
    }
  }
}

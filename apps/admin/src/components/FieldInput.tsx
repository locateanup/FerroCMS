import type { Field } from '../lib/types.js';
import { RelationInput } from './RelationInput.js';
import { MediaInput } from './MediaInput.js';

interface Props {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
}

function label(field: Field): string {
  return field.label ?? field.name.charAt(0).toUpperCase() + field.name.slice(1);
}

export function FieldInput({ field, value, onChange }: Props) {
  if (field.admin?.hidden) return null;

  const common = { id: field.name, placeholder: field.admin?.placeholder };

  return (
    <div className="field">
      <label htmlFor={field.name}>
        {label(field)}
        {field.required ? ' *' : ''}
      </label>
      {renderControl()}
      {field.description ? <div className="help">{field.description}</div> : null}
    </div>
  );

  function renderControl() {
    switch (field.type) {
      case 'textarea':
      case 'richText':
        return (
          <textarea
            {...common}
            rows={field.type === 'richText' ? 8 : 3}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
          />
        );
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

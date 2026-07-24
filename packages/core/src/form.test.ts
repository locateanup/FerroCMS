import { describe, expect, it } from 'vitest';
import { defineForm, buildFormRegistry } from './form.js';
import { validateEntry } from './validation.js';
import type { Field } from './fields.js';

const contactFields: Field[] = [
  { name: 'name', type: 'text', required: true, maxLength: 100 },
  { name: 'email', type: 'text', required: true, maxLength: 200 },
  { name: 'message', type: 'textarea', required: true, maxLength: 2000 },
];

describe('defineForm', () => {
  it('applies defaults and humanizes the name', () => {
    const f = defineForm({ slug: 'contact', fields: contactFields });
    expect(f.name).toBe('Contact');
    expect(f.fields).toHaveLength(3);
  });

  it('honors an explicit name', () => {
    const f = defineForm({ slug: 'contact', name: 'Contact us', fields: contactFields });
    expect(f.name).toBe('Contact us');
  });

  it('rejects an invalid slug', () => {
    expect(() => defineForm({ slug: 'Bad Slug', fields: contactFields })).toThrow();
  });

  it('rejects a form with no fields', () => {
    expect(() => defineForm({ slug: 'contact', fields: [] })).toThrow(/at least one field/);
  });

  it('rejects duplicate field names', () => {
    expect(() =>
      defineForm({
        slug: 'contact',
        fields: [
          { name: 'email', type: 'text' },
          { name: 'email', type: 'text' },
        ],
      }),
    ).toThrow(/duplicate/i);
  });

  it('validates submissions the same way entries are validated', () => {
    const f = defineForm({ slug: 'contact', fields: contactFields });
    const ok = validateEntry(f.fields, { name: 'Alice', email: 'a@example.com', message: 'Hi' });
    expect(ok.success).toBe(true);

    const missing = validateEntry(f.fields, { name: 'Alice' });
    expect(missing.success).toBe(false);
  });
});

describe('buildFormRegistry', () => {
  it('looks forms up by slug', () => {
    const f = defineForm({ slug: 'contact', fields: contactFields });
    const registry = buildFormRegistry([f]);
    expect(registry.get('contact')).toBe(f);
  });

  it('rejects duplicate slugs', () => {
    const f = defineForm({ slug: 'contact', fields: contactFields });
    expect(() => buildFormRegistry([f, f])).toThrow(/duplicate/i);
  });
});

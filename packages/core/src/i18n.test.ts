import { describe, expect, it } from 'vitest';
import { defineCollection } from './collection.js';
import { validateEntry } from './validation.js';
import type { Field } from './fields.js';

describe('defineCollection: locales', () => {
  it('throws when a localized field is declared without locales', () => {
    expect(() =>
      defineCollection({
        slug: 'pages',
        fields: [{ name: 'title', type: 'text', localized: true }],
      }),
    ).toThrow(/locales/);
  });

  it('defaults defaultLocale to the first declared locale', () => {
    const c = defineCollection({
      slug: 'pages',
      locales: ['en', 'fr'],
      fields: [{ name: 'title', type: 'text', localized: true }],
    });
    expect(c.locales).toEqual(['en', 'fr']);
    expect(c.defaultLocale).toBe('en');
  });

  it('throws when defaultLocale is not in locales', () => {
    expect(() =>
      defineCollection({
        slug: 'pages',
        locales: ['en', 'fr'],
        defaultLocale: 'de',
        fields: [{ name: 'title', type: 'text', localized: true }],
      }),
    ).toThrow(/defaultLocale/);
  });

  it('does not require locales when no field is localized', () => {
    const c = defineCollection({
      slug: 'pages',
      fields: [{ name: 'title', type: 'text' }],
    });
    expect(c.locales).toEqual([]);
    expect(c.defaultLocale).toBeUndefined();
  });
});

describe('validateEntry: localized fields', () => {
  const fields: Field[] = [
    { name: 'title', type: 'text', localized: true, required: true },
    { name: 'views', type: 'number' },
  ];
  const opts = { locales: ['en', 'fr'] };

  it('accepts a partial per-locale record', () => {
    const result = validateEntry(fields, { title: { en: 'Hello' } }, opts);
    expect(result.success).toBe(true);
    expect((result.data?.title as Record<string, string>).en).toBe('Hello');
  });

  it('accepts all declared locales filled in', () => {
    const result = validateEntry(fields, { title: { en: 'Hello', fr: 'Bonjour' } }, opts);
    expect(result.success).toBe(true);
  });

  it('rejects a locale key that was not declared', () => {
    const result = validateEntry(fields, { title: { de: 'Hallo' } }, opts);
    expect(result.success).toBe(false);
  });

  it('does not require the field to be filled for every locale', () => {
    const result = validateEntry(fields, {}, opts);
    expect(result.success).toBe(true);
  });

  it('rejects a plain string where a per-locale record is expected', () => {
    const result = validateEntry(fields, { title: 'Hello' }, opts);
    expect(result.success).toBe(false);
  });

  it('leaves non-localized fields as plain values', () => {
    const result = validateEntry(fields, { views: 5 }, opts);
    expect(result.success).toBe(true);
    expect(result.data?.views).toBe(5);
  });
});

import { describe, expect, it } from 'vitest';
import { defineTaxonomy } from './taxonomy.js';
import { defineCollection } from './collection.js';
import { validateEntry } from './validation.js';
import type { Field } from './fields.js';

describe('defineTaxonomy', () => {
  it('injects name/slug/description and a hierarchical parent field by default', () => {
    const categories = defineTaxonomy({ slug: 'categories' });
    const names = categories.fields.map((f) => f.name);
    expect(names).toEqual(['name', 'slug', 'description', 'parent']);
    expect(categories.taxonomyConfig).toEqual({ enabled: true, hierarchical: true });
    expect(categories.drafts).toBe(false);
    expect(categories.admin.useAsTitle).toBe('name');

    const parent = categories.fields.find((f) => f.name === 'parent');
    expect(parent).toMatchObject({ type: 'relation', relationTo: 'categories' });
  });

  it('omits the parent field when non-hierarchical', () => {
    const tags = defineTaxonomy({ slug: 'tags', hierarchical: false });
    expect(tags.fields.map((f) => f.name)).toEqual(['name', 'slug', 'description']);
    expect(tags.taxonomyConfig).toEqual({ enabled: true, hierarchical: false });
  });

  it('does not duplicate a user-declared parent field', () => {
    const custom = defineTaxonomy({
      slug: 'categories',
      extraFields: [{ name: 'parent', type: 'relation', relationTo: 'categories', many: true }],
    });
    expect(custom.fields.filter((f) => f.name === 'parent')).toHaveLength(1);
    expect(custom.fields.find((f) => f.name === 'parent')).toMatchObject({ many: true });
  });

  it('supports extra fields', () => {
    const categories = defineTaxonomy({
      slug: 'categories',
      extraFields: [{ name: 'color', type: 'text' }],
    });
    expect(categories.fields.map((f) => f.name)).toContain('color');
  });
});

describe('defineCollection: taxonomy field', () => {
  const fields: Field[] = [
    { name: 'title', type: 'text', required: true },
    { name: 'tags', type: 'taxonomy', taxonomy: 'tags' },
  ];

  it('accepts a taxonomy field referencing another collection', () => {
    const c = defineCollection({ slug: 'posts', fields });
    expect(c.fields.find((f) => f.name === 'tags')).toMatchObject({ taxonomy: 'tags' });
  });

  it('rejects a taxonomy field without a taxonomy slug', () => {
    expect(() =>
      defineCollection({
        slug: 'posts',
        // @ts-expect-error intentionally missing taxonomy
        fields: [{ name: 'tags', type: 'taxonomy' }],
      }),
    ).toThrow(/taxonomy/);
  });
});

describe('validateEntry: taxonomy field', () => {
  const fields: Field[] = [{ name: 'tags', type: 'taxonomy', taxonomy: 'tags' }];
  const singleFields: Field[] = [
    { name: 'category', type: 'taxonomy', taxonomy: 'categories', many: false },
  ];

  it('defaults to accepting an array of term ids', () => {
    const result = validateEntry(fields, { tags: ['a', 'b'] });
    expect(result.success).toBe(true);
  });

  it('rejects a single string when many is not false', () => {
    const result = validateEntry(fields, { tags: 'a' });
    expect(result.success).toBe(false);
  });

  it('accepts a single string when many: false', () => {
    const result = validateEntry(singleFields, { category: 'a' });
    expect(result.success).toBe(true);
  });

  it('rejects an array when many: false', () => {
    const result = validateEntry(singleFields, { category: ['a'] });
    expect(result.success).toBe(false);
  });
});

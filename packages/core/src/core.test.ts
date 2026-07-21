import { describe, expect, it } from 'vitest';
import { defineCollection } from './collection.js';
import { validateEntry } from './validation.js';
import { slugify } from './slug.js';
import { atLeast, resolveAccess } from './access.js';
import type { Field } from './fields.js';

const postFields: Field[] = [
  { name: 'title', type: 'text', required: true, maxLength: 200 },
  { name: 'slug', type: 'slug', from: 'title' },
  { name: 'views', type: 'number', integer: true, min: 0 },
  { name: 'featured', type: 'boolean' },
  { name: 'status', type: 'select', options: [{ label: 'A', value: 'a' }] },
];

describe('defineCollection', () => {
  it('applies defaults and infers useAsTitle', () => {
    const c = defineCollection({ slug: 'posts', fields: postFields.slice(0, 2) });
    expect(c.timestamps).toBe(true);
    expect(c.drafts).toBe(true);
    expect(c.admin.useAsTitle).toBe('title');
    expect(c.labels.plural).toBe('Posts');
  });

  it('rejects an invalid slug', () => {
    expect(() => defineCollection({ slug: 'Bad Slug', fields: postFields.slice(0, 1) })).toThrow();
  });

  it('rejects reserved field names', () => {
    expect(() =>
      defineCollection({ slug: 'posts', fields: [{ name: 'id', type: 'text' }] }),
    ).toThrow(/reserved/);
  });

  it('rejects duplicate field names', () => {
    expect(() =>
      defineCollection({
        slug: 'posts',
        fields: [
          { name: 'title', type: 'text' },
          { name: 'title', type: 'text' },
        ],
      }),
    ).toThrow(/duplicate/);
  });

  it('rejects relation fields without relationTo', () => {
    expect(() =>
      defineCollection({
        slug: 'posts',
        // @ts-expect-error intentionally missing relationTo
        fields: [{ name: 'author', type: 'relation' }],
      }),
    ).toThrow(/relationTo/);
  });
});

describe('validateEntry', () => {
  it('accepts valid data and strips nothing extra', () => {
    const result = validateEntry(postFields, { title: 'Hello', views: 3 });
    expect(result.success).toBe(true);
    expect(result.data?.title).toBe('Hello');
  });

  it('rejects a missing required field', () => {
    const result = validateEntry(postFields, { views: 3 });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === 'title')).toBe(true);
  });

  it('rejects unknown keys', () => {
    const result = validateEntry(postFields, { title: 'Hi', nope: 1 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer for an integer field', () => {
    const result = validateEntry(postFields, { title: 'Hi', views: 1.5 });
    expect(result.success).toBe(false);
  });

  it('allows missing required fields in partial mode', () => {
    const result = validateEntry(postFields, { views: 5 }, { partial: true });
    expect(result.success).toBe(true);
  });
});

describe('slugify', () => {
  it('normalizes text into a url-safe slug', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
    expect(slugify('  Trailing  spaces  ')).toBe('trailing-spaces');
  });
});

describe('access', () => {
  it('atLeast enforces role rank', () => {
    const editorOnly = atLeast('editor');
    expect(editorOnly({ user: { id: '1', role: 'admin' } })).toBe(true);
    expect(editorOnly({ user: { id: '1', role: 'editor' } })).toBe(true);
    expect(editorOnly({ user: { id: '1', role: 'author' } })).toBe(false);
    expect(editorOnly({ user: null })).toBe(false);
  });

  it('resolveAccess fills defaults', () => {
    const access = resolveAccess();
    expect(access.read({ user: null })).toBe(true);
    expect(access.delete({ user: { id: '1', role: 'author' } })).toBe(false);
  });
});

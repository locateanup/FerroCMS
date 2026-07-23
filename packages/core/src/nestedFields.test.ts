import { describe, expect, it } from 'vitest';
import { defineCollection } from './collection.js';
import { validateEntry } from './validation.js';
import { evaluateCondition, type Field } from './fields.js';

describe('group fields', () => {
  const fields: Field[] = [
    { name: 'title', type: 'text', required: true },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'metaTitle', type: 'text', maxLength: 60 },
        { name: 'metaDescription', type: 'textarea', maxLength: 160 },
      ],
    },
  ];

  it('accepts a valid nested object', () => {
    const result = validateEntry(fields, {
      title: 'Hi',
      seo: { metaTitle: 'Hi there', metaDescription: 'A page.' },
    });
    expect(result.success).toBe(true);
    expect((result.data?.seo as Record<string, unknown>).metaTitle).toBe('Hi there');
  });

  it('rejects an invalid nested value with a nested error path', () => {
    const result = validateEntry(fields, {
      title: 'Hi',
      seo: { metaTitle: 'x'.repeat(100) },
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === 'seo.metaTitle')).toBe(true);
  });

  it('rejects unknown keys inside the group', () => {
    const result = validateEntry(fields, { title: 'Hi', seo: { nope: 1 } });
    expect(result.success).toBe(false);
  });

  it('defineCollection rejects a group with no sub-fields', () => {
    expect(() =>
      defineCollection({
        slug: 'pages',
        fields: [{ name: 'title', type: 'text' }, { name: 'seo', type: 'group', fields: [] }],
      }),
    ).toThrow(/at least one field/);
  });

  it('defineCollection rejects duplicate names within a group', () => {
    expect(() =>
      defineCollection({
        slug: 'pages',
        fields: [
          { name: 'title', type: 'text' },
          {
            name: 'seo',
            type: 'group',
            fields: [
              { name: 'metaTitle', type: 'text' },
              { name: 'metaTitle', type: 'text' },
            ],
          },
        ],
      }),
    ).toThrow(/duplicate/i);
  });

  it('defineCollection rejects a relation inside a group with no relationTo', () => {
    expect(() =>
      defineCollection({
        slug: 'pages',
        fields: [
          { name: 'title', type: 'text' },
          {
            name: 'hero',
            type: 'group',
            // @ts-expect-error intentionally missing relationTo
            fields: [{ name: 'author', type: 'relation' }],
          },
        ],
      }),
    ).toThrow(/relationTo/);
  });

  it('allows a field nested inside a group to reuse a top-level name (different paths)', () => {
    const c = defineCollection({
      slug: 'pages',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'seo', type: 'group', fields: [{ name: 'title', type: 'text' }] },
      ],
    });
    expect(c.fields).toHaveLength(2);
  });
});

describe('repeater fields', () => {
  const fields: Field[] = [
    { name: 'title', type: 'text', required: true },
    {
      name: 'links',
      type: 'repeater',
      minRows: 1,
      maxRows: 3,
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
  ];

  it('accepts a valid array of rows', () => {
    const result = validateEntry(fields, {
      title: 'Hi',
      links: [{ label: 'Home', url: '/' }, { label: 'About', url: '/about' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a row missing a required sub-field', () => {
    const result = validateEntry(fields, { title: 'Hi', links: [{ label: 'Home' }] });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === 'links.0.url')).toBe(true);
  });

  it('enforces minRows', () => {
    const result = validateEntry(fields, { title: 'Hi', links: [] });
    expect(result.success).toBe(false);
  });

  it('enforces maxRows', () => {
    const result = validateEntry(fields, {
      title: 'Hi',
      links: [
        { label: 'a', url: '/a' },
        { label: 'b', url: '/b' },
        { label: 'c', url: '/c' },
        { label: 'd', url: '/d' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('supports a repeater of groups (nested nesting)', () => {
    const nested: Field[] = [
      {
        name: 'sections',
        type: 'repeater',
        fields: [
          { name: 'heading', type: 'text', required: true },
          {
            name: 'cta',
            type: 'group',
            fields: [{ name: 'label', type: 'text' }, { name: 'url', type: 'text' }],
          },
        ],
      },
    ];
    const result = validateEntry(nested, {
      sections: [{ heading: 'Intro', cta: { label: 'Learn more', url: '/learn' } }],
    });
    expect(result.success).toBe(true);
  });
});

describe('evaluateCondition', () => {
  it('equals', () => {
    expect(evaluateCondition({ field: 'kind', equals: 'video' }, { kind: 'video' })).toBe(true);
    expect(evaluateCondition({ field: 'kind', equals: 'video' }, { kind: 'image' })).toBe(false);
  });

  it('notEquals', () => {
    expect(evaluateCondition({ field: 'kind', notEquals: 'video' }, { kind: 'image' })).toBe(true);
    expect(evaluateCondition({ field: 'kind', notEquals: 'video' }, { kind: 'video' })).toBe(false);
  });

  it('truthy', () => {
    expect(evaluateCondition({ field: 'hasDiscount', truthy: true }, { hasDiscount: true })).toBe(
      true,
    );
    expect(evaluateCondition({ field: 'hasDiscount', truthy: true }, { hasDiscount: false })).toBe(
      false,
    );
    expect(
      evaluateCondition({ field: 'hasDiscount', truthy: false }, { hasDiscount: false }),
    ).toBe(true);
  });

  it('defaults to visible when the condition is empty', () => {
    expect(evaluateCondition({ field: 'kind' }, {})).toBe(true);
  });
});

describe('conditional required fields', () => {
  const fields: Field[] = [
    { name: 'hasDiscount', type: 'boolean' },
    {
      name: 'discountPercent',
      type: 'number',
      required: true,
      admin: { condition: { field: 'hasDiscount', truthy: true } },
    },
  ];

  it('is not required when the condition does not hold', () => {
    const result = validateEntry(fields, { hasDiscount: false });
    expect(result.success).toBe(true);
  });

  it('is required when the condition holds', () => {
    const result = validateEntry(fields, { hasDiscount: true });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === 'discountPercent')).toBe(true);
  });

  it('passes when the condition holds and the value is present', () => {
    const result = validateEntry(fields, { hasDiscount: true, discountPercent: 10 });
    expect(result.success).toBe(true);
  });
});

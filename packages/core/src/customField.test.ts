import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineCustomField } from './customField.js';
import { registerFieldType, unregisterFieldType, validateEntry } from './validation.js';
import { defineCollection } from './collection.js';

const HEX_RE = /^#[0-9a-f]{6}$/i;

afterEach(() => {
  unregisterFieldType('color');
});

describe('custom field types', () => {
  it('validates a registered custom field type', () => {
    registerFieldType('color', () => z.string().regex(HEX_RE, 'Must be a hex color'));

    const fields = [defineCustomField({ name: 'accent', type: 'color', required: true })];

    expect(validateEntry(fields, { accent: '#FF00AA' }).success).toBe(true);
    expect(validateEntry(fields, { accent: 'not-a-color' }).success).toBe(false);
  });

  it('respects the custom field factory reading config off the field', () => {
    registerFieldType('color', (field) => {
      const allowAlpha = (field as unknown as { allowAlpha?: boolean }).allowAlpha === true;
      return z.string().regex(allowAlpha ? /^#[0-9a-f]{6,8}$/i : HEX_RE);
    });

    const fields = [defineCustomField({ name: 'accent', type: 'color', allowAlpha: true })];
    expect(validateEntry(fields, { accent: '#ff00aacc' }).success).toBe(true);
  });

  it('throws a clear error for an unregistered custom type', () => {
    const fields = [defineCustomField({ name: 'accent', type: 'color' })];
    expect(() => validateEntry(fields, { accent: '#ffffff' })).toThrow(
      /Unknown field type "color"/,
    );
  });

  it('works inside a full collection definition', () => {
    registerFieldType('color', () => z.string().regex(HEX_RE));
    const collection = defineCollection({
      slug: 'themes',
      fields: [
        { name: 'name', type: 'text', required: true },
        defineCustomField({ name: 'accent', type: 'color', required: true }),
      ],
    });
    const result = validateEntry(collection.fields, { name: 'Dark', accent: '#000000' });
    expect(result.success).toBe(true);
  });
});

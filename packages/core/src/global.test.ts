import { describe, expect, it } from 'vitest';
import { defineGlobal, resolveGlobalAccess, buildGlobalRegistry } from './global.js';
import { atLeast } from './access.js';
import type { Field } from './fields.js';

const settingsFields: Field[] = [
  { name: 'siteName', type: 'text', required: true, maxLength: 120 },
  { name: 'footerText', type: 'textarea' },
];

describe('defineGlobal', () => {
  it('applies defaults and humanizes the label', () => {
    const g = defineGlobal({ slug: 'site-settings', fields: settingsFields });
    expect(g.label).toBe('Site settings');
    expect(g.fields).toHaveLength(2);
  });

  it('honors an explicit label', () => {
    const g = defineGlobal({ slug: 'site-settings', label: 'Settings', fields: settingsFields });
    expect(g.label).toBe('Settings');
  });

  it('rejects an invalid slug', () => {
    expect(() => defineGlobal({ slug: 'Bad Slug', fields: settingsFields })).toThrow();
  });

  it('rejects a global with no fields', () => {
    expect(() => defineGlobal({ slug: 'site-settings', fields: [] })).toThrow(/at least one field/);
  });

  it('rejects reserved field names', () => {
    expect(() =>
      defineGlobal({ slug: 'site-settings', fields: [{ name: 'id', type: 'text' }] }),
    ).toThrow(/reserved/);
  });

  it('rejects duplicate field names', () => {
    expect(() =>
      defineGlobal({
        slug: 'site-settings',
        fields: [
          { name: 'siteName', type: 'text' },
          { name: 'siteName', type: 'text' },
        ],
      }),
    ).toThrow(/duplicate/i);
  });

  it('rejects a relation field with no relationTo', () => {
    expect(() =>
      defineGlobal({
        slug: 'site-settings',
        // @ts-expect-error intentionally missing relationTo
        fields: [{ name: 'logo', type: 'relation' }],
      }),
    ).toThrow(/relationTo/);
  });
});

describe('resolveGlobalAccess', () => {
  it('defaults to public read, editor+ update', () => {
    const access = resolveGlobalAccess();
    expect(access.read({ user: null })).toBe(true);
    expect(access.update({ user: null })).toBe(false);
    expect(access.update({ user: { id: '1', role: 'editor' } })).toBe(true);
    expect(access.update({ user: { id: '1', role: 'author' } })).toBe(false);
  });

  it('honors explicit overrides', () => {
    const access = resolveGlobalAccess({ update: atLeast('admin') });
    expect(access.update({ user: { id: '1', role: 'editor' } })).toBe(false);
    expect(access.update({ user: { id: '1', role: 'admin' } })).toBe(true);
  });
});

describe('buildGlobalRegistry', () => {
  it('looks globals up by slug', () => {
    const g = defineGlobal({ slug: 'site-settings', fields: settingsFields });
    const registry = buildGlobalRegistry([g]);
    expect(registry.get('site-settings')).toBe(g);
  });

  it('rejects duplicate slugs', () => {
    const g = defineGlobal({ slug: 'site-settings', fields: settingsFields });
    expect(() => buildGlobalRegistry([g, g])).toThrow(/duplicate/i);
  });
});

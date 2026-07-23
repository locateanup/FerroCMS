import { describe, expect, it } from 'vitest';
import { localize } from './i18n.js';

describe('localize', () => {
  const data = {
    title: 'Untranslated', // not in localizedFields, left as-is
    body: { en: 'Hello', fr: 'Bonjour' },
    views: 5,
  };

  it('picks the requested locale for localized fields', () => {
    const result = localize(data, ['body'], 'fr');
    expect(result.body).toBe('Bonjour');
    expect(result.title).toBe('Untranslated');
    expect(result.views).toBe(5);
  });

  it('falls back when the locale is missing', () => {
    const result = localize(data, ['body'], 'de', 'en');
    expect(result.body).toBe('Hello');
  });

  it('returns undefined with no fallback and a missing locale', () => {
    const result = localize(data, ['body'], 'de');
    expect(result.body).toBeUndefined();
  });

  it('leaves non-object values untouched even if listed as localized', () => {
    const result = localize(data, ['title'], 'fr');
    expect(result.title).toBe('Untranslated');
  });

  it('does not mutate the input', () => {
    const copy = { ...data, body: { ...data.body } };
    localize(data, ['body'], 'fr');
    expect(data).toEqual(copy);
  });
});

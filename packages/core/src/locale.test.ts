import { describe, expect, it } from 'vitest';
import { isRtlLocale } from './locale.js';

describe('isRtlLocale', () => {
  it('recognizes bare RTL language codes', () => {
    expect(isRtlLocale('ar')).toBe(true);
    expect(isRtlLocale('he')).toBe(true);
    expect(isRtlLocale('fa')).toBe(true);
  });

  it('recognizes RTL codes with a region subtag', () => {
    expect(isRtlLocale('ar-SA')).toBe(true);
    expect(isRtlLocale('he-IL')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isRtlLocale('AR')).toBe(true);
    expect(isRtlLocale('Ar-SA')).toBe(true);
  });

  it('returns false for LTR locales', () => {
    expect(isRtlLocale('en')).toBe(false);
    expect(isRtlLocale('fr')).toBe(false);
    expect(isRtlLocale('en-US')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { sanitizeFolder } from './media.js';

describe('sanitizeFolder', () => {
  it('returns null for empty/undefined input', () => {
    expect(sanitizeFolder(undefined)).toBeNull();
    expect(sanitizeFolder('')).toBeNull();
    expect(sanitizeFolder('   ')).toBeNull();
  });

  it('lowercases and trims slashes', () => {
    expect(sanitizeFolder('/Products/2026/')).toBe('products/2026');
  });

  it('strips unsafe characters from each segment', () => {
    expect(sanitizeFolder('my folder!/../etc<script>')).toBe('myfolder/etcscript');
  });

  it('caps nesting depth at 4 segments', () => {
    expect(sanitizeFolder('a/b/c/d/e/f')).toBe('a/b/c/d');
  });

  it('drops empty segments from repeated slashes', () => {
    expect(sanitizeFolder('a//b')).toBe('a/b');
  });

  it('returns null when every character is stripped', () => {
    expect(sanitizeFolder('!!!///???')).toBeNull();
  });
});

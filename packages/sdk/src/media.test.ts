import { describe, expect, it } from 'vitest';
import { buildSrcSet, RESPONSIVE_WIDTHS } from './media.js';

describe('buildSrcSet', () => {
  it('builds one entry per width, in order, with the ?w= query param', () => {
    const result = buildSrcSet('https://cms.example.com/api/media/file/2024/abc.png');
    const entries = result.split(', ');
    expect(entries).toHaveLength(RESPONSIVE_WIDTHS.length);
    expect(entries[0]).toBe('https://cms.example.com/api/media/file/2024/abc.png?w=320 320w');
    expect(entries.at(-1)).toBe(
      `https://cms.example.com/api/media/file/2024/abc.png?w=${RESPONSIVE_WIDTHS.at(-1)} ${RESPONSIVE_WIDTHS.at(-1)}w`,
    );
  });

  it('excludes widths above maxWidth', () => {
    const result = buildSrcSet('https://cms.example.com/img.png', 768);
    expect(result).toContain('w=768');
    expect(result).not.toContain('w=1024');
  });
});

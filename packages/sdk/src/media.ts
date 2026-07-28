/**
 * Responsive image variants — the API generates (and caches) a resized
 * variant on first request for `?w=<one of these>` against a PNG/JPEG media
 * URL (see apps/api/src/routes/media.ts). Kept in sync with that route's own
 * `RESPONSIVE_WIDTHS` list by convention, not a shared import (the SDK stays
 * dependency-free and doesn't import from the API).
 */
export const RESPONSIVE_WIDTHS = [320, 640, 768, 1024, 1280, 1536, 1920] as const;

/**
 * Build a `srcset` attribute value for a media URL (from `client.mediaUrl(key)`),
 * limited to widths at or below `maxWidth` (skip generating variants larger
 * than you'll ever display).
 */
export function buildSrcSet(mediaUrl: string, maxWidth = Math.max(...RESPONSIVE_WIDTHS)): string {
  return RESPONSIVE_WIDTHS.filter((w) => w <= maxWidth)
    .map((w) => `${mediaUrl}?w=${w} ${w}w`)
    .join(', ');
}

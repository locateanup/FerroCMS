import { describe, expect, it } from 'vitest';
import { detectImageDimensions } from './imageMeta.js';

function bytesFrom(values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer;
}

function ascii(s: string): number[] {
  return Array.from(s).map((c) => c.charCodeAt(0));
}

describe('detectImageDimensions', () => {
  it('reads PNG dimensions from the IHDR chunk', () => {
    const bytes = bytesFrom([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a, // signature
      0x00,
      0x00,
      0x00,
      0x0d, // chunk length (13, unused by parser)
      ...ascii('IHDR'),
      0x00,
      0x00,
      0x00,
      0x64, // width = 100
      0x00,
      0x00,
      0x00,
      0x32, // height = 50
    ]);
    expect(detectImageDimensions(bytes, 'image/png')).toEqual({ width: 100, height: 50 });
  });

  it('reads GIF dimensions (little-endian)', () => {
    const bytes = bytesFrom([...ascii('GIF89a'), 0x64, 0x00, 0x32, 0x00]); // 100x50
    expect(detectImageDimensions(bytes, 'image/gif')).toEqual({ width: 100, height: 50 });
  });

  it('reads baseline JPEG dimensions from the SOF0 marker', () => {
    const bytes = bytesFrom([
      0xff,
      0xd8, // SOI
      0xff,
      0xc0, // SOF0
      0x00,
      0x11, // segment length (17)
      0x08, // precision
      0x00,
      0x64, // height = 100
      0x00,
      0x32, // width = 50
      0x03, // component count
      0x01,
      0x11,
      0x00,
      0x02,
      0x11,
      0x00,
      0x03,
      0x11,
      0x00,
    ]);
    expect(detectImageDimensions(bytes, 'image/jpeg')).toEqual({ width: 50, height: 100 });
  });

  it('reads WebP (VP8X) dimensions', () => {
    const bytes = bytesFrom([
      ...ascii('RIFF'),
      0x1a,
      0x00,
      0x00,
      0x00, // file size (unused)
      ...ascii('WEBP'),
      ...ascii('VP8X'),
      0x0a,
      0x00,
      0x00,
      0x00, // chunk size (unused)
      0x00, // flags
      0x00,
      0x00,
      0x00, // reserved
      0xc7,
      0x00,
      0x00, // width - 1 = 199 -> width = 200
      0x63,
      0x00,
      0x00, // height - 1 = 99 -> height = 100
    ]);
    expect(detectImageDimensions(bytes, 'image/webp')).toEqual({ width: 200, height: 100 });
  });

  it('returns null for a truncated/invalid PNG', () => {
    expect(detectImageDimensions(bytesFrom([0x89, 0x50, 0x4e, 0x47]), 'image/png')).toBeNull();
  });

  it('returns null for an unsupported mime type', () => {
    expect(detectImageDimensions(bytesFrom([0, 1, 2, 3]), 'application/pdf')).toBeNull();
  });

  it('returns null instead of throwing on garbage bytes', () => {
    expect(() => detectImageDimensions(bytesFrom([1, 2, 3]), 'image/png')).not.toThrow();
    expect(detectImageDimensions(bytesFrom([1, 2, 3]), 'image/jpeg')).toBeNull();
  });
});

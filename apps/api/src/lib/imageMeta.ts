/**
 * Pure-JS image dimension detection from file headers — no native deps (no
 * `sharp`/native bindings), so it works identically on Workers and Node.
 * Only reads the handful of header bytes needed; never decodes pixel data.
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

function readUInt32BE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! << 24) |
    (bytes[offset + 1]! << 16) |
    (bytes[offset + 2]! << 8) |
    bytes[offset + 3]!
  );
}
function readUInt16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}
function readUInt16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readPng(bytes: Uint8Array): ImageDimensions | null {
  // 8-byte signature, then an IHDR chunk: length(4) type(4) width(4) height(4).
  if (bytes.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (bytes[i] !== signature[i]) return null;
  return { width: readUInt32BE(bytes, 16), height: readUInt32BE(bytes, 20) };
}

function readGif(bytes: Uint8Array): ImageDimensions | null {
  // "GIF87a" / "GIF89a" header, then width/height as little-endian uint16.
  if (bytes.length < 10) return null;
  const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38;
  if (!isGif) return null;
  return { width: readUInt16LE(bytes, 6), height: readUInt16LE(bytes, 8) };
}

function readJpeg(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1]!;
    // SOF0-SOF3, SOF5-SOF7, SOF9-SOF11, SOF13-SOF15 carry dimensions; skip
    // restart markers and standalone markers with no length field.
    const isSOF =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    const segmentLength = readUInt16BE(bytes, offset + 2);
    if (isSOF) {
      const height = readUInt16BE(bytes, offset + 5);
      const width = readUInt16BE(bytes, offset + 7);
      return { width, height };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function readWebp(bytes: Uint8Array): ImageDimensions | null {
  // "RIFF"....."WEBP", then a chunk. Support the common VP8X/VP8/VP8L forms.
  if (bytes.length < 30) return null;
  const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (!isRiff || !isWebp) return null;

  const chunk = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
  if (chunk === 'VP8X') {
    // 24-bit little-endian width-1 / height-1 at offsets 24 and 27.
    const width = (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)) + 1;
    const height = (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)) + 1;
    return { width, height };
  }
  if (chunk === 'VP8 ') {
    const width = readUInt16LE(bytes, 26) & 0x3fff;
    const height = readUInt16LE(bytes, 28) & 0x3fff;
    return { width, height };
  }
  if (chunk === 'VP8L') {
    const b0 = bytes[21]!;
    const b1 = bytes[22]!;
    const b2 = bytes[23]!;
    const b3 = bytes[24]!;
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height };
  }
  return null;
}

/** Detect an image's pixel dimensions from its header bytes. Returns null if unsupported/unparseable. */
export function detectImageDimensions(
  bytes: ArrayBuffer,
  mimeType: string,
): ImageDimensions | null {
  const view = new Uint8Array(bytes);
  try {
    switch (mimeType) {
      case 'image/png':
        return readPng(view);
      case 'image/gif':
        return readGif(view);
      case 'image/jpeg':
        return readJpeg(view);
      case 'image/webp':
        return readWebp(view);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

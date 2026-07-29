/**
 * Real pixel resizing for responsive image variants — decode -> resize ->
 * re-encode via WASM codecs (jSquash/Squoosh), not just the pure-JS *header*
 * parsing in imageMeta.ts (which only reads the dimensions a file already
 * has). WASM runs identically in Cloudflare Workers and Node — no native
 * bindings (sharp) needed, so this works on both runtimes this project
 * targets.
 *
 * Codec loading is registered as a lazy callback (`registerImageCodecLoader`)
 * rather than called eagerly at startup, and deliberately not imported here
 * directly: Wrangler's bundler turns a `.wasm` import into an already-compiled
 * `WebAssembly.Module`, but that same static import fails under Vite/vitest
 * (used by every test in this repo, including ones that import the Workers
 * entry point) — see platform/cloudflareWasm.ts, the one file with real
 * `.wasm` imports, which only a dynamic `import()` ever reaches, and only
 * once a real resize request arrives.
 */

import { decode as decodePng, encode as encodePng } from '@jsquash/png';
import { init as initPngDecode } from '@jsquash/png/decode.js';
import { init as initPngEncode } from '@jsquash/png/encode.js';
import decodeJpeg, { init as initJpegDecode } from '@jsquash/jpeg/decode.js';
import encodeJpeg, { init as initJpegEncode } from '@jsquash/jpeg/encode.js';
import resize, { initResize } from '@jsquash/resize';

export interface ImageCodecModules {
  pngCodec: WebAssembly.Module;
  jpegDecodeCodec: WebAssembly.Module;
  jpegEncodeCodec: WebAssembly.Module;
  resizeCodec: WebAssembly.Module;
}

type ImageCodecLoader = () => Promise<ImageCodecModules>;

let loader: ImageCodecLoader | undefined;
let ready: Promise<void> | undefined;

/** Call once at startup with a function that loads (but doesn't yet use) the platform's WASM modules. */
export function registerImageCodecLoader(load: ImageCodecLoader): void {
  loader = load;
}

function ensureReady(): Promise<void> {
  if (!ready) {
    if (!loader) throw new Error('registerImageCodecLoader() was not called at startup.');
    ready = loader()
      .then((modules) =>
        Promise.all([
          initPngDecode(modules.pngCodec),
          initPngEncode(modules.pngCodec),
          initJpegDecode(modules.jpegDecodeCodec),
          initJpegEncode(modules.jpegEncodeCodec),
          initResize(modules.resizeCodec),
        ]).then(() => undefined),
      )
      .catch((err: unknown) => {
        // Don't wedge every future request behind one transient failure
        // (e.g. a cold-start hiccup reading the WASM bytes) — let the next
        // call to ensureReady() try loading the codecs again.
        ready = undefined;
        throw err;
      });
  }
  return ready;
}

/** PNG and JPEG only — the two formats worth generating resized variants for. */
export const RESIZABLE_MIME_TYPES = new Set(['image/png', 'image/jpeg']);

export interface ResizedImage {
  width: number;
  data: Uint8Array;
}

/**
 * Resize to each of `widths`, preserving aspect ratio, skipping any width
 * that isn't actually smaller than the source (no pointless upscaling).
 * Returns [] for a mime type we don't know how to decode.
 */
export async function generateResponsiveVariants(
  bytes: ArrayBuffer,
  mimeType: string,
  widths: number[],
): Promise<ResizedImage[]> {
  if (!RESIZABLE_MIME_TYPES.has(mimeType)) return [];
  await ensureReady();

  const isPng = mimeType === 'image/png';
  const decoded = isPng ? await decodePng(bytes) : await decodeJpeg(bytes);

  const targets = widths.filter((w) => w > 0 && w < decoded.width);
  const variants: ResizedImage[] = [];
  for (const width of targets) {
    const height = Math.max(1, Math.round((decoded.height / decoded.width) * width));
    const resized = await resize(decoded, { width, height });
    const encoded = isPng ? await encodePng(resized) : await encodeJpeg(resized);
    variants.push({ width, data: new Uint8Array(encoded) });
  }
  return variants;
}

/**
 * Isolated on purpose: this is the ONLY file with static `.wasm` imports.
 * Wrangler's bundler resolves them into already-compiled `WebAssembly.Module`
 * objects at build time — but under Vite/vitest (used for every other test
 * in this repo, including ones that import the Workers entry point) that
 * same static import tries to resolve the wasm-bindgen glue as real JS
 * imports and fails ("Cannot find package 'wbg'"). Since nothing imports
 * *this* file except a dynamic `import()` from index.ts's lazy codec loader
 * (see lib/imageResize.ts's `registerImageCodecLoader`), and only once an
 * actual image-resize request arrives, no test ever touches it.
 */
import pngWasm from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm';
import jpegDecodeWasm from '@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm';
import jpegEncodeWasm from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm';
import resizeWasm from '@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm';
import type { ImageCodecModules } from '../lib/imageResize.js';

export function cloudflareImageCodecs(): ImageCodecModules {
  return {
    pngCodec: pngWasm,
    jpegDecodeCodec: jpegDecodeWasm,
    jpegEncodeCodec: jpegEncodeWasm,
    resizeCodec: resizeWasm,
  };
}

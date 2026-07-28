/**
 * Cloudflare Workers' bundler compiles a `.wasm` import into an already-ready
 * `WebAssembly.Module` at build time — this just types that for TypeScript,
 * which has no ambient type for `.wasm` specifiers on its own.
 */
declare module '*.wasm' {
  const module: WebAssembly.Module;
  export default module;
}

// The wildcard above doesn't apply once the bundler-mode resolver finds a
// real file on disk at the exact specifier (which these deep node_modules
// paths always do) — so these need their own exact-path declarations too.
declare module '@jsquash/png/codec/pkg/squoosh_png_bg.wasm' {
  const module: WebAssembly.Module;
  export default module;
}
declare module '@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm' {
  const module: WebAssembly.Module;
  export default module;
}
declare module '@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm' {
  const module: WebAssembly.Module;
  export default module;
}
declare module '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm' {
  const module: WebAssembly.Module;
  export default module;
}

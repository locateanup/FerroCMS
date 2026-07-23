/**
 * TOTP (RFC 6238) two-factor authentication — self-contained, no external
 * OAuth app or account needed (unlike SSO). Uses Web Crypto (`crypto.subtle`)
 * so it runs identically on Workers and Node. Compatible with standard
 * authenticator apps (Google Authenticator, Authy, 1Password, ...).
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Uint8Array): string {
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let output = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder !== 0) {
    const lastChunk = bits.slice(bits.length - remainder).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(lastChunk, 2)];
  }
  return output;
}

export function base32Decode(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of clean) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

/** Generate a new random base32 secret (20 bytes = 160 bits, the RFC 4226 default). */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(bytes)));
}

function counterToBytes(counter: number): Uint8Array {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  return new Uint8Array(buf);
}

async function hmacSha1(keyBytes: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, message as BufferSource);
  return new Uint8Array(sig);
}

export interface TotpOptions {
  /** Code length. Default 6 (the common authenticator-app convention). */
  digits?: number;
  /** Time step in seconds. Default 30. */
  stepSeconds?: number;
}

async function totpAtCounter(
  secretBase32: string,
  counter: number,
  digits: number,
): Promise<string> {
  const hmac = await hmacSha1(base32Decode(secretBase32), counterToBytes(counter));
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

/** Generate the current TOTP code. `time` is a Unix timestamp in milliseconds. */
export async function generateTotp(
  secretBase32: string,
  time: number = Date.now(),
  opts: TotpOptions = {},
): Promise<string> {
  const step = opts.stepSeconds ?? 30;
  const digits = opts.digits ?? 6;
  const counter = Math.floor(time / 1000 / step);
  return totpAtCounter(secretBase32, counter, digits);
}

/** Verify a token, tolerating ±1 time step of clock drift between client and server. */
export async function verifyTotp(
  secretBase32: string,
  token: string,
  time: number = Date.now(),
  opts: TotpOptions = {},
): Promise<boolean> {
  const step = opts.stepSeconds ?? 30;
  const digits = opts.digits ?? 6;
  const counter = Math.floor(time / 1000 / step);
  const clean = token.trim();
  for (const delta of [0, -1, 1]) {
    if ((await totpAtCounter(secretBase32, counter + delta, digits)) === clean) return true;
  }
  return false;
}

/** Build an `otpauth://` provisioning URI for authenticator apps (manual entry or QR). */
export function totpProvisioningUri(opts: {
  secret: string;
  accountName: string;
  issuer: string;
  digits?: number;
  stepSeconds?: number;
}): string {
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer: opts.issuer,
    algorithm: 'SHA1',
    digits: String(opts.digits ?? 6),
    period: String(opts.stepSeconds ?? 30),
  });
  const label = encodeURIComponent(`${opts.issuer}:${opts.accountName}`);
  return `otpauth://totp/${label}?${params.toString()}`;
}

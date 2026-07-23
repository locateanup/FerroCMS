/**
 * Signed preview tokens — the backend half of "live preview." An
 * authenticated editor (who already has read access to the entry) mints a
 * short-lived token for one specific entry; the public preview endpoint
 * accepts only that exact token, for that exact entry, before it expires.
 * Same pattern as Next.js draft mode / Contentful / Sanity preview links:
 * your front-end's preview route calls the CMS with this token and renders
 * the draft, bypassing static generation for that request only.
 *
 * The token does not grant elevated field-level access — only the
 * published-only gate is bypassed; field-level `access.read` rules still
 * apply as if the request were anonymous.
 */

import { hmacSha256Hex, timingSafeEqual } from './crypto.js';

function payloadString(collection: string, id: string, exp: number): string {
  return `${collection}:${id}:${exp}`;
}

/** Mint a preview token for one entry. `ttlSeconds` defaults to 10 minutes. */
export async function createPreviewToken(
  secret: string,
  collection: string,
  id: string,
  ttlSeconds = 600,
): Promise<{ token: string; expiresAt: number }> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = await hmacSha256Hex(secret, payloadString(collection, id, exp));
  return { token: `${exp}.${sig}`, expiresAt: exp };
}

/** Verify a token was minted for exactly this collection + entry and hasn't expired. */
export async function verifyPreviewToken(
  secret: string,
  collection: string,
  id: string,
  token: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const [expStr, sig] = token.split('.');
  if (!expStr || !sig) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < nowSeconds) return false;
  const expected = await hmacSha256Hex(secret, payloadString(collection, id, exp));
  return timingSafeEqual(expected, sig);
}

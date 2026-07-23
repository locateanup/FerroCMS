/**
 * A simple fixed-window rate limiter backed by the same KV adapter used for
 * sessions (works on both Cloudflare Workers and Node — no separate service).
 *
 * This is read-then-write, not atomic, so under heavy concurrent load from a
 * single key a few extra requests can slip through a window boundary. That's
 * an acceptable trade-off for slowing down brute-force login attempts; it is
 * not a precise billing-grade limiter.
 */

import type { KVAdapter } from '../platform/types.js';

export interface RateLimitOptions {
  /** Window size in seconds. */
  windowSeconds: number;
  /** Max requests allowed per window. */
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

interface WindowState {
  windowStart: number;
  count: number;
}

/** Check and record a request against a rate-limit key. */
export async function checkRateLimit(
  kv: KVAdapter,
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const kvKey = `ratelimit:${key}`;
  const now = Date.now();
  const raw = await kv.get(kvKey);

  let state: WindowState = { windowStart: now, count: 0 };
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as WindowState;
      if (now - parsed.windowStart < opts.windowSeconds * 1000) {
        state = parsed;
      }
    } catch {
      /* corrupt/unexpected value — treat as a fresh window */
    }
  }

  state.count += 1;
  await kv.put(kvKey, JSON.stringify(state), { expirationTtl: opts.windowSeconds });

  return { allowed: state.count <= opts.max, remaining: Math.max(0, opts.max - state.count) };
}

/** Best-effort client IP: Cloudflare header first, then the common proxy header. */
export function clientIp(headers: { get(name: string): string | null }): string {
  return (
    headers.get('cf-connecting-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

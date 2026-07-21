import type { Context } from 'hono';
import type { AppBindings } from '../env.js';

/**
 * Run a promise in the background. On Cloudflare Workers this uses
 * `executionCtx.waitUntil`; on Node (where there is no execution context) it
 * simply detaches the promise. Errors are swallowed either way.
 */
export function background(c: Context<AppBindings>, promise: Promise<unknown>): void {
  try {
    c.executionCtx.waitUntil(promise);
  } catch {
    void promise.then(
      () => undefined,
      () => undefined,
    );
  }
}

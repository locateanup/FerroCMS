/**
 * Outbound webhooks — the "on-publish, revalidate my site" mechanism for
 * headless front-ends. On content changes we POST a small JSON event to each
 * configured URL, optionally HMAC-signed so receivers can verify authenticity.
 */

import { hmacSha256Hex } from './crypto.js';

export type WebhookEventType =
  'entry.created' | 'entry.updated' | 'entry.published' | 'entry.deleted';

export interface WebhookEvent {
  event: WebhookEventType;
  collection: string;
  id: string;
  slug: string | null;
  status: string;
  timestamp: string;
}

export const SIGNATURE_HEADER = 'x-ferrocms-signature';

/** Parse the configured webhook URLs from the environment. */
interface SendOptions {
  urls: string[];
  secret?: string;
  event: WebhookEvent;
  fetchImpl?: typeof fetch;
}

/** POST the event to every URL. Failures are swallowed (best-effort delivery). */
export async function sendWebhooks(options: SendOptions): Promise<void> {
  const body = JSON.stringify(options.event);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.secret) {
    headers[SIGNATURE_HEADER] = await hmacSha256Hex(options.secret, body);
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  await Promise.all(
    options.urls.map((url) =>
      fetchImpl(url, { method: 'POST', headers, body }).then(
        () => undefined,
        () => undefined,
      ),
    ),
  );
}

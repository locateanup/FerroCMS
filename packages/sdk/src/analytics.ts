/**
 * Google Analytics 4 — the standard gtag.js snippet + typed helpers for
 * pageview/event tracking, framework-agnostic (React/Vue/Next/Astro/plain
 * HTML all just need the two script tags and a `window.gtag` call). You
 * still need your own GA4 measurement ID — create a free GA4 property at
 * https://analytics.google.com and get the "G-XXXXXXXXXX" id from Admin >
 * Data Streams. FerroCMS can't create that account for you; everything past
 * that point is real, working code.
 */

export interface GaScriptTag {
  src?: string;
  /** Inline script body — present only on the second, config tag. */
  html?: string;
  async?: true;
}

/**
 * The two tags Google's own snippet consists of: an async loader script and
 * an inline config call. Render both, in order, in your document `<head>`.
 */
export function gtagScriptTags(measurementId: string): GaScriptTag[] {
  return [
    {
      src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`,
      async: true,
    },
    {
      html: [
        `window.dataLayer = window.dataLayer || [];`,
        `function gtag(){dataLayer.push(arguments);}`,
        `gtag('js', new Date());`,
        `gtag('config', ${JSON.stringify(measurementId)});`,
      ].join('\n'),
    },
  ];
}

type Gtag = (command: 'event', action: string, params?: Record<string, unknown>) => void;

function getGtag(): Gtag | undefined {
  return (globalThis as unknown as { gtag?: Gtag }).gtag;
}

/** Send a GA4 pageview — call on each client-side route change (GA4 doesn't auto-track SPA navigations). */
export function trackPageview(path: string, title?: string): void {
  getGtag()?.('event', 'page_view', { page_path: path, page_title: title });
}

/** Send a custom GA4 event. `params` becomes the event's parameters (matches gtag's own shape). */
export function trackEvent(action: string, params?: Record<string, unknown>): void {
  getGtag()?.('event', action, params);
}

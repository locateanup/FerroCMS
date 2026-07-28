import { afterEach, describe, expect, it, vi } from 'vitest';
import { gtagScriptTags, trackEvent, trackPageview } from './analytics.js';

describe('gtagScriptTags', () => {
  it('builds the loader tag pointing at the given measurement id', () => {
    const [loader] = gtagScriptTags('G-ABC123');
    expect(loader!.src).toBe('https://www.googletagmanager.com/gtag/js?id=G-ABC123');
    expect(loader!.async).toBe(true);
  });

  it('builds the inline config tag matching the documented gtag.js snippet shape', () => {
    const [, config] = gtagScriptTags('G-ABC123');
    expect(config!.html).toContain('window.dataLayer = window.dataLayer || [];');
    expect(config!.html).toContain('function gtag(){dataLayer.push(arguments);}');
    expect(config!.html).toContain("gtag('js', new Date());");
    expect(config!.html).toContain(`gtag('config', "G-ABC123");`);
  });
});

describe('trackPageview / trackEvent', () => {
  afterEach(() => {
    delete (globalThis as { gtag?: unknown }).gtag;
  });

  it('calls window.gtag with a page_view event', () => {
    const gtag = vi.fn();
    (globalThis as unknown as { gtag: typeof gtag }).gtag = gtag;

    trackPageview('/blog/hello-world', 'Hello World');

    expect(gtag).toHaveBeenCalledWith('event', 'page_view', {
      page_path: '/blog/hello-world',
      page_title: 'Hello World',
    });
  });

  it('calls window.gtag with a custom event', () => {
    const gtag = vi.fn();
    (globalThis as unknown as { gtag: typeof gtag }).gtag = gtag;

    trackEvent('signup', { plan: 'pro' });

    expect(gtag).toHaveBeenCalledWith('event', 'signup', { plan: 'pro' });
  });

  it('no-ops silently when gtag is not present (e.g. GA blocked)', () => {
    expect(() => trackEvent('signup')).not.toThrow();
  });
});

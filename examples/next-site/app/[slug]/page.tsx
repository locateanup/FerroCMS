import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildMeta, isRtlLocale, localize, renderRichTextHtml, type RichTextValue } from '@ferrocms/sdk';
import { cms } from '../../lib/cms';

interface PageData {
  [key: string]: unknown;
  title: string;
  // `body` is a localized field — stored as { en: [...blocks], fr: [...], ar: [...] }.
  body?: Record<string, RichTextValue>;
}

export const revalidate = 60;

async function getPage(slug: string) {
  const page = await cms.findBySlug<PageData>('pages', slug);
  if (!page || page.status !== 'published') return null;
  return page;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const page = await getPage(params.slug);
  if (!page) return {};
  const meta = buildMeta(page, { urlPattern: '/:slug', fallbackTitle: page.data.title });
  return { title: meta.title, description: meta.description };
}

export default async function StaticPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { lang?: string };
}) {
  const page = await getPage(params.slug);
  if (!page) notFound();

  // e.g. /about?lang=fr or /about?lang=ar — falls back to English.
  const locale = searchParams.lang ?? 'en';
  // `localize()` resolves `body` from a per-locale record down to a single
  // RichTextValue, but its return type keeps T's original (per-locale) shape
  // for that key — so the resolved value needs an explicit cast here.
  const body = localize(page.data, ['body'], locale, 'en').body as unknown as
    | RichTextValue
    | undefined;

  return (
    <main dir={isRtlLocale(locale) ? 'rtl' : 'ltr'} style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1>{page.data.title}</h1>
      {body && <div dangerouslySetInnerHTML={{ __html: renderRichTextHtml(body) }} />}
    </main>
  );
}

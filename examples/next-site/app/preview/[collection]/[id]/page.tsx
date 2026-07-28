import { notFound } from 'next/navigation';
import { renderRichTextHtml, type RichTextValue } from '@ferrocms/sdk';
import { cms } from '../../../../lib/cms';

// A preview must always hit the CMS for the current draft — never cache it.
export const dynamic = 'force-dynamic';

interface PreviewData {
  [key: string]: unknown;
  title?: string;
  // `body` is either a plain RichTextValue or, for a localized field, a
  // per-locale record of them — same ambiguity the [slug] page handles.
  body?: RichTextValue | Record<string, RichTextValue>;
}

function resolveBody(body: PreviewData['body']): RichTextValue | undefined {
  if (!body) return undefined;
  if (Array.isArray(body)) return body;
  return body.en ?? Object.values(body)[0];
}

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ collection: string; id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ collection, id }, { token }] = await Promise.all([params, searchParams]);
  if (!token) notFound();

  const entry = await cms.preview<PreviewData>(collection, id, token);
  if (!entry) notFound();

  const body = resolveBody(entry.data.body);
  const title = typeof entry.data.title === 'string' ? entry.data.title : '(untitled)';

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <div
        style={{
          background: '#fffbe6',
          border: '1px solid #f0d878',
          borderRadius: 4,
          padding: '8px 12px',
          marginBottom: 16,
          fontSize: 13,
        }}
      >
        Preview — status: {entry.status}
      </div>
      <h1>{title}</h1>
      {body && <div dangerouslySetInnerHTML={{ __html: renderRichTextHtml(body) }} />}
    </main>
  );
}

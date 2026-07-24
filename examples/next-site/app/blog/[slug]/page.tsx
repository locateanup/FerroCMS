import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildMeta, renderRichTextHtml, type RichTextValue } from '@ferrocms/sdk';
import { cms } from '../../../lib/cms';

interface PostData {
  [key: string]: unknown;
  title: string;
  excerpt?: string;
  body?: RichTextValue;
  coverImage?: string;
  metaTitle?: string;
  metaDescription?: string;
}

export const revalidate = 60;

async function getPost(slug: string) {
  const post = await cms.findBySlug<PostData>('posts', slug);
  if (!post || post.status !== 'published') return null;
  return post;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return {};
  const meta = buildMeta(post, {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    urlPattern: '/blog/:slug',
    fallbackTitle: post.data.title,
  });
  return { title: meta.title, description: meta.description };
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) notFound();

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1>{post.data.title}</h1>
      {post.data.coverImage && (
        // Plain <img>, not next/image — the media host varies by deployment
        // (R2, filesystem, ...) and isn't known ahead of time.
        <img src={cms.mediaUrl(post.data.coverImage)} alt="" style={{ maxWidth: '100%' }} />
      )}
      {/* renderRichTextHtml escapes all inline text — safe to render directly. */}
      {post.data.body && (
        <div dangerouslySetInnerHTML={{ __html: renderRichTextHtml(post.data.body) }} />
      )}
    </main>
  );
}

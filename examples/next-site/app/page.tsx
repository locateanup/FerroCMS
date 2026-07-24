import Link from 'next/link';
import { cms } from '../lib/cms';

interface PostSummary {
  title: string;
  excerpt?: string;
}

// Re-fetch at most once a minute — matches the CMS's own public-read cache TTL.
export const revalidate = 60;

export default async function HomePage() {
  const { items } = await cms.find<PostSummary>('posts', { status: 'published', limit: 20 });

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1>Blog</h1>
      {items.length === 0 && <p>No posts yet — create one in the FerroCMS admin.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {items.map((post) => (
          <li key={post.id} style={{ marginBottom: 24 }}>
            <Link href={`/blog/${post.slug}`}>
              <h2>{post.data.title}</h2>
            </Link>
            {post.data.excerpt && <p>{post.data.excerpt}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}

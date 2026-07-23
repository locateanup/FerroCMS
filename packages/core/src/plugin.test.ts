import { describe, expect, it, vi } from 'vitest';
import { applyPlugins, definePlugin } from './plugin.js';
import { defineCollection } from './collection.js';

const posts = defineCollection({
  slug: 'posts',
  fields: [{ name: 'title', type: 'text', required: true }],
});

describe('applyPlugins', () => {
  it('returns the base collections unchanged when there are no plugins', () => {
    const result = applyPlugins([posts], []);
    expect(result).toEqual([posts]);
  });

  it('adds a plugin-contributed collection', () => {
    const comments = defineCollection({
      slug: 'comments',
      fields: [{ name: 'body', type: 'textarea', required: true }],
    });
    const plugin = definePlugin({ name: 'comments-plugin', collections: [comments] });

    const result = applyPlugins([posts], [plugin]);
    expect(result.map((c) => c.slug).sort()).toEqual(['comments', 'posts']);
  });

  it('throws when a plugin collection slug collides with an existing one', () => {
    const dup = defineCollection({
      slug: 'posts',
      fields: [{ name: 'x', type: 'text' }],
    });
    const plugin = definePlugin({ name: 'bad-plugin', collections: [dup] });

    expect(() => applyPlugins([posts], [plugin])).toThrow(/collides/);
  });

  it('merges an afterChange hook into an existing collection', async () => {
    const spy = vi.fn();
    const plugin = definePlugin({
      name: 'audit-plugin',
      hooks: { posts: { afterChange: [spy] } },
    });

    const [result] = applyPlugins([posts], [plugin]);
    expect(result!.hooks?.afterChange).toHaveLength(1);

    await result!.hooks!.afterChange![0]!({
      operation: 'create',
      doc: { title: 'Hi' },
      user: null,
    });
    expect(spy).toHaveBeenCalledOnce();
  });

  it('composes hooks from multiple plugins in order', () => {
    const order: string[] = [];
    const pluginA = definePlugin({
      name: 'a',
      hooks: { posts: { afterChange: [() => void order.push('a')] } },
    });
    const pluginB = definePlugin({
      name: 'b',
      hooks: { posts: { afterChange: [() => void order.push('b')] } },
    });

    const [result] = applyPlugins([posts], [pluginA, pluginB]);
    expect(result!.hooks?.afterChange).toHaveLength(2);
  });

  it('throws when a plugin targets an unknown collection', () => {
    const plugin = definePlugin({ name: 'ghost', hooks: { nope: { afterChange: [() => {}] } } });
    expect(() => applyPlugins([posts], [plugin])).toThrow(/unknown collection/);
  });

  it('lets a later plugin hook into an earlier plugin-contributed collection', () => {
    const comments = defineCollection({
      slug: 'comments',
      fields: [{ name: 'body', type: 'textarea', required: true }],
    });
    const contributor = definePlugin({ name: 'contributor', collections: [comments] });
    const hooker = definePlugin({
      name: 'hooker',
      hooks: { comments: { afterChange: [() => {}] } },
    });

    const result = applyPlugins([posts], [contributor, hooker]);
    const commentsResult = result.find((c) => c.slug === 'comments');
    expect(commentsResult?.hooks?.afterChange).toHaveLength(1);
  });
});

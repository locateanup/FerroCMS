import { useEffect, useState } from 'react';
import { api } from './api.js';
import type { CollectionSchema } from './types.js';

let cache: Promise<CollectionSchema[]> | null = null;

export function loadCollections(): Promise<CollectionSchema[]> {
  if (!cache) cache = api.collections().then((r) => r.items);
  return cache;
}

export function useCollections(): { collections: CollectionSchema[]; loading: boolean } {
  const [collections, setCollections] = useState<CollectionSchema[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    loadCollections()
      .then(setCollections)
      .finally(() => setLoading(false));
  }, []);
  return { collections, loading };
}

export function useCollection(slug: string | undefined): CollectionSchema | undefined {
  const { collections } = useCollections();
  return collections.find((c) => c.slug === slug);
}

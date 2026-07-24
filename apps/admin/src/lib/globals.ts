import { useEffect, useState } from 'react';
import { api } from './api.js';
import type { GlobalSchema } from './types.js';

let cache: Promise<GlobalSchema[]> | null = null;

export function loadGlobals(): Promise<GlobalSchema[]> {
  if (!cache) cache = api.globals().then((r) => r.items);
  return cache;
}

export function useGlobals(): { globals: GlobalSchema[]; loading: boolean } {
  const [globals, setGlobals] = useState<GlobalSchema[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    loadGlobals()
      .then(setGlobals)
      .finally(() => setLoading(false));
  }, []);
  return { globals, loading };
}

export function useGlobal(slug: string | undefined): GlobalSchema | undefined {
  const { globals } = useGlobals();
  return globals.find((g) => g.slug === slug);
}

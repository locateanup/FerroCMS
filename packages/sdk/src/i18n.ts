/**
 * Flatten a FerroCMS entry's localized fields (stored as `{ en: ..., fr: ... }`
 * records) down to plain values for one locale, with an optional fallback.
 * The SDK has no schema, so you tell it which top-level keys are localized —
 * the same list you declared as `localized: true` in your collection config.
 */

export function localize<T extends Record<string, unknown>>(
  data: T,
  localizedFields: ReadonlyArray<keyof T>,
  locale: string,
  fallbackLocale?: string,
): T {
  const out = { ...data };
  for (const key of localizedFields) {
    const value = data[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      const resolved = locale in record ? record[locale] : undefined;
      out[key] = (resolved ?? (fallbackLocale ? record[fallbackLocale] : undefined)) as T[keyof T];
    }
  }
  return out;
}

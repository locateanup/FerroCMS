/**
 * Flatten a FerroCMS entry's localized fields (stored as `{ en: ..., fr: ... }`
 * records) down to plain values for one locale, with an optional fallback.
 * The SDK has no schema, so you tell it which top-level keys are localized —
 * the same list you declared as `localized: true` in your collection config.
 */

/**
 * Right-to-left locale detection, for setting `dir="rtl"` when rendering
 * localized content. Matches on the base language subtag, so `ar`, `ar-SA`,
 * `AR` all count. Kept in sync with the same set in @ferrocms/core — the SDK
 * stays dependency-free, so this is duplicated rather than imported.
 */
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'yi', 'ps', 'sd', 'ug']);

export function isRtlLocale(locale: string): boolean {
  const lang = locale.split('-')[0]!.toLowerCase();
  return RTL_LANGUAGES.has(lang);
}

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

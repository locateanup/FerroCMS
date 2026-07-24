/**
 * Right-to-left locale detection — used to flip the admin editor's text
 * inputs (and available for front-ends rendering localized content) when
 * editing/displaying a locale like Arabic or Hebrew. Matches on the base
 * language subtag, so `ar`, `ar-SA`, `AR` all count.
 */

const RTL_LANGUAGES = new Set([
  'ar', // Arabic
  'he', // Hebrew
  'fa', // Persian/Farsi
  'ur', // Urdu
  'yi', // Yiddish
  'ps', // Pashto
  'sd', // Sindhi
  'ug', // Uyghur
]);

export function isRtlLocale(locale: string): boolean {
  const lang = locale.split('-')[0]!.toLowerCase();
  return RTL_LANGUAGES.has(lang);
}

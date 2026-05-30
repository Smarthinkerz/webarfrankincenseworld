export const locales = ['en', 'ja', 'ar'] as const;
export type Locale = (typeof locales)[number];

export function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export function normalizeLocale(value: string | undefined): Locale {
  return isLocale(value) ? value : 'en';
}

export function directionForLocale(locale: Locale) {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

import { directionForLocale, normalizeLocale } from '@/lib/locales';

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = normalizeLocale(localeParam);
  return <div dir={directionForLocale(locale)}>{children}</div>;
}

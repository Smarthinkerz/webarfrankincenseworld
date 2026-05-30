import { FrontPage } from '@/components/front-page';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { getPublishedCmsContent } from '@/lib/cms-store';
import { normalizeLocale } from '@/lib/locales';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = normalizeLocale(localeParam);
  const content = await getPublishedCmsContent(locale);
  return (
    <>
      <SiteHeader locale={locale} />
      <FrontPage content={content} locale={locale} />
      <SiteFooter locale={locale} />
    </>
  );
}

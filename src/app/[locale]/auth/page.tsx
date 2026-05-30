import { AuthPanel } from '@/components/auth-panel';
import { SiteHeader } from '@/components/site-header';
import { normalizeLocale } from '@/lib/locales';

export default async function AuthPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = normalizeLocale(localeParam);
  return (
    <>
      <SiteHeader locale={locale} />
      <main className="grid min-h-[72vh] place-items-center px-6 py-12">
        <AuthPanel mode="user" />
      </main>
    </>
  );
}

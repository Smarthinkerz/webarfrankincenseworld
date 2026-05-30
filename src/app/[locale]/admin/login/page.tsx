import { AuthPanel } from '@/components/auth-panel';
import { ButtonLink } from '@/components/button';
import { SiteHeader } from '@/components/site-header';
import { normalizeLocale } from '@/lib/locales';

export default async function AdminLoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = normalizeLocale(localeParam);
  return (
    <>
      <SiteHeader locale={locale} />
      <main className="grid min-h-[72vh] place-items-center px-6 py-12">
        <div className="w-full max-w-md space-y-4">
          <AuthPanel mode="admin" />
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-center text-sm text-white/60">
            For visual review in this sandbox, open the CMS live preview without production credentials.<br />
            <ButtonLink className="mt-4" href={`/${locale}/admin/cms-preview`} variant="secondary">Open CMS live preview</ButtonLink>
          </div>
        </div>
      </main>
    </>
  );
}

import { SiteHeader } from '@/components/site-header';
import { normalizeLocale } from '@/lib/locales';

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = normalizeLocale(localeParam);
  return (
    <>
      <SiteHeader locale={locale} />
      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="glass rounded-[2rem] p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan/80">Workspace</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.03em]">AR campaign dashboard</h1>
          <p className="mt-4 max-w-2xl text-white/65">Production dashboards should be connected to Supabase-authenticated user data and campaign analytics. This route is present for navigation and deployment validation.</p>
        </div>
      </main>
    </>
  );
}

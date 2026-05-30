import { CmsLiveEditor } from '@/components/admin/cms-live-editor';
import { getPublishedCmsContent } from '@/lib/cms-store';
import { normalizeLocale } from '@/lib/locales';
import { requireAdmin } from '@/lib/auth';

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = normalizeLocale(localeParam);
  await requireAdmin(locale);
  const content = await getPublishedCmsContent(locale);
  return <CmsLiveEditor initialContent={content} />;
}

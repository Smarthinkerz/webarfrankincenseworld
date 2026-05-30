import { CmsLiveEditor } from '@/components/admin/cms-live-editor';
import { defaultCmsContent } from '@/lib/cms-defaults';
import { normalizeLocale } from '@/lib/locales';

export default async function AdminCmsPreviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = normalizeLocale(localeParam);
  return <CmsLiveEditor initialContent={defaultCmsContent(locale)} reviewMode />;
}

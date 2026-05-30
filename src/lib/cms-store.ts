import { defaultCmsContent } from './cms-defaults';
import type { CmsContent, CmsPayload } from './cms-schema';
import { isSupabaseConfigured } from './config';
import type { Locale } from './locales';
import { createSupabaseServiceClient } from './supabase/server';

export async function getPublishedCmsContent(locale: Locale): Promise<CmsContent> {
  if (!isSupabaseConfigured()) return defaultCmsContent(locale);
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from('cms_pages')
    .select('content')
    .eq('locale', locale)
    .eq('page_key', 'home')
    .eq('publication_status', 'published')
    .maybeSingle();
  if (error || !data?.content) return defaultCmsContent(locale);
  return data.content as CmsContent;
}

export async function upsertCmsPayload(payload: CmsPayload, adminUserId: string) {
  if (!isSupabaseConfigured()) {
    return { ok: false, status: 503, message: 'Supabase production credentials are required before CMS changes can be persisted.' };
  }
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from('cms_pages').upsert({
    page_key: 'home',
    locale: payload.locale,
    content: payload.content,
    publication_status: payload.publicationStatus,
    updated_by: adminUserId,
    updated_at: new Date().toISOString()
  }, { onConflict: 'page_key,locale,publication_status' });
  if (error) return { ok: false, status: 500, message: error.message };
  return { ok: true, status: 200, message: payload.publicationStatus === 'published' ? 'Published.' : 'Draft saved.' };
}

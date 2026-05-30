import { createClient } from '@supabase/supabase-js';
import { defaultCmsContent } from './cms-defaults';
import type { ArVideoPlayback, CmsContent } from './cms-schema';
import type { Locale } from './locales';

const PUREWELLS_SLUG = 'purewells-wacandy-japan';
const PUREWELLS_TARGET_IMAGE_URL = 'https://sotwadzvuuqvzncmtjqg.supabase.co/storage/v1/object/public/ar-targets/Owa%20Stamp%20EXPO.png';
const PUREWELLS_VIDEO_URL = 'https://sotwadzvuuqvzncmtjqg.supabase.co/storage/v1/object/public/ar-videos/purewells-video.mp4';
const PUREWELLS_TRACKING_DATA_URL = '/ar-tracking/purewells-tracking.mind';

const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

type ArCampaignRow = {
  id?: string;
  name?: string | null;
  slug?: string | null;
  status?: 'draft' | 'published' | 'archived' | string | null;
  headline?: string | null;
  instructions?: string | null;
  target_label?: string | null;
  target_image_url?: string | null;
  target_image_alt?: string | null;
  tracking_dataset_url?: string | null;
  tracking_data_url?: string | null;
  tracking_mode?: string | null;
  video_url?: string | null;
  video_poster_url?: string | null;
  video_title?: string | null;
  playback_mode?: string | null;
  video_playback?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

function isUsableSecret(value: string, placeholderFragment: string) {
  return value.trim().length > 0 && !value.includes(placeholderFragment);
}

function hasPublicSupabaseConfig() {
  return PUBLIC_SUPABASE_URL.startsWith('https://') && isUsableSecret(PUBLIC_SUPABASE_ANON_KEY, 'placeholder');
}

function hasServiceSupabaseConfig() {
  return PUBLIC_SUPABASE_URL.startsWith('https://') && isUsableSecret(SERVICE_ROLE_KEY, 'placeholder');
}

function createCampaignClient() {
  if (!hasPublicSupabaseConfig() && !hasServiceSupabaseConfig()) return null;

  return createClient(
    PUBLIC_SUPABASE_URL,
    hasServiceSupabaseConfig() ? SERVICE_ROLE_KEY : PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function normalizePlayback(value: string | null | undefined): ArVideoPlayback {
  if (value === 'tap-to-play' || value === 'tap_to_play') return 'tap-to-play';
  return 'autoplay-on-detect';
}

function normalizeString(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function isRemoteAssetUrl(value: string) {
  if (!value.startsWith('http://') && !value.startsWith('https://')) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

async function remoteAssetExists(url: string) {
  if (!isRemoteAssetUrl(url)) return true;

  try {
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(3500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function withValidatedAssets(content: CmsContent): Promise<CmsContent> {
  const [targetOk, trackingOk, videoOk, posterOk] = await Promise.all([
    remoteAssetExists(content.app.targetImageUrl),
    content.app.trackingDataUrl ? remoteAssetExists(content.app.trackingDataUrl) : Promise.resolve(true),
    content.app.videoUrl ? remoteAssetExists(content.app.videoUrl) : Promise.resolve(true),
    content.app.videoPosterUrl ? remoteAssetExists(content.app.videoPosterUrl) : Promise.resolve(true)
  ]);
  const isPurewells = content.app.slug === PUREWELLS_SLUG;

  return {
    ...content,
    app: {
      ...content.app,
      targetImageUrl: targetOk ? content.app.targetImageUrl : '/sample-ar-target.svg',
      trackingDataUrl: trackingOk ? content.app.trackingDataUrl : isPurewells ? PUREWELLS_TRACKING_DATA_URL : '',
      videoUrl: videoOk ? content.app.videoUrl : '',
      videoPosterUrl: posterOk ? content.app.videoPosterUrl : '/sample-video-poster.svg'
    }
  };
}

function purewellsFallbackContent(locale: Locale): CmsContent {
  const fallback = defaultCmsContent(locale);
  return {
    ...fallback,
    updatedAt: new Date().toISOString(),
    app: {
      ...fallback.app,
      slug: PUREWELLS_SLUG,
      name: 'Purewells Wacandy Japan',
      headline: 'Scan the Purewells Wacandy Japan image target to unlock the campaign video experience.',
      instructions:
        'Open this page on a mobile device, tap Start camera, allow camera access, and point the camera at the printed Wacandy target image. The campaign video will appear over the target when it is detected.',
      targetLabel: 'Purewells Wacandy Japan target: Owa Stamp EXPO',
      trackingMode: 'image-target',
      targetImageUrl: PUREWELLS_TARGET_IMAGE_URL,
      targetImageAlt: 'Purewells Wacandy Japan Owa Stamp EXPO image target',
      trackingDataUrl: PUREWELLS_TRACKING_DATA_URL,
      videoUrl: PUREWELLS_VIDEO_URL,
      videoPosterUrl: '/sample-video-poster.svg',
      videoTitle: 'Purewells Wacandy Japan campaign video',
      videoPlayback: 'autoplay-on-detect',
      status: 'published',
      overlays: [
        {
          title: 'Target image is live',
          body: 'The public Supabase Storage target image is connected and ready for the campaign scan experience.'
        },
        {
          title: 'Video asset is live',
          body: 'The public Supabase Storage video is connected and ready to play when the scan target is detected.'
        },
        {
          title: 'Image tracking is ready',
          body: 'A compiled MindAR image-target dataset is bundled with the scanner so camera-based recognition can run in the test preview.'
        }
      ]
    }
  };
}

function genericFallbackContent(slug: string, locale: Locale): CmsContent {
  const fallback = defaultCmsContent(locale);
  return {
    ...fallback,
    app: {
      ...fallback.app,
      slug,
      name: 'Campaign unavailable',
      headline: 'This AR campaign is not published yet.',
      instructions: 'The requested campaign could not be loaded. Please confirm the scan URL or publish the campaign in the admin CMS.',
      status: 'draft',
      overlays: [
        {
          title: 'No published campaign found',
          body: 'The public scanner only displays campaigns that exist in Supabase with published status.'
        }
      ]
    }
  };
}

function mapRowToCmsContent(row: ArCampaignRow, locale: Locale): CmsContent {
  const fallback = row.slug === PUREWELLS_SLUG ? purewellsFallbackContent(locale) : genericFallbackContent(row.slug || 'campaign', locale);
  const trackingDataUrl = normalizeString(row.tracking_dataset_url) || normalizeString(row.tracking_data_url) || fallback.app.trackingDataUrl;

  return {
    ...fallback,
    updatedAt: normalizeString(row.updated_at) || normalizeString(row.published_at) || normalizeString(row.created_at) || new Date().toISOString(),
    app: {
      ...fallback.app,
      slug: normalizeString(row.slug) || fallback.app.slug,
      name: normalizeString(row.name) || fallback.app.name,
      headline: normalizeString(row.headline) || fallback.app.headline,
      instructions: normalizeString(row.instructions) || fallback.app.instructions,
      targetLabel: normalizeString(row.target_label) || fallback.app.targetLabel,
      trackingMode: row.tracking_mode === 'manual-preview' || row.tracking_mode === 'manual_preview' ? 'manual-preview' : 'image-target',
      targetImageUrl: normalizeString(row.target_image_url) || fallback.app.targetImageUrl,
      targetImageAlt: normalizeString(row.target_image_alt) || fallback.app.targetImageAlt,
      trackingDataUrl,
      videoUrl: normalizeString(row.video_url),
      videoPosterUrl: normalizeString(row.video_poster_url) || fallback.app.videoPosterUrl,
      videoTitle: normalizeString(row.video_title) || fallback.app.videoTitle,
      videoPlayback: normalizePlayback(row.playback_mode || row.video_playback),
      status: row.status === 'published' ? 'published' : 'draft',
      overlays: fallback.app.overlays
    }
  };
}

export async function getPublishedArCampaignContent(slug: string, locale: Locale = 'en'): Promise<CmsContent> {
  const safeSlug = slug.trim().toLowerCase();
  const fallback = safeSlug === PUREWELLS_SLUG ? purewellsFallbackContent(locale) : genericFallbackContent(safeSlug || 'campaign', locale);
  const supabase = createCampaignClient();

  if (!safeSlug || !supabase) return withValidatedAssets(fallback);

  const { data, error } = await supabase
    .from('ar_campaigns')
    .select('*')
    .eq('slug', safeSlug)
    .eq('status', 'published')
    .limit(1)
    .maybeSingle<ArCampaignRow>();

  if (error || !data) return withValidatedAssets(fallback);
  return withValidatedAssets(mapRowToCmsContent(data, locale));
}

export const purewellsCampaign = {
  slug: PUREWELLS_SLUG,
  targetImageUrl: PUREWELLS_TARGET_IMAGE_URL,
  videoUrl: PUREWELLS_VIDEO_URL,
  trackingDataUrl: PUREWELLS_TRACKING_DATA_URL
};

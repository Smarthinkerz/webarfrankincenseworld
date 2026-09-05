import type { Metadata } from 'next';
import { WebArPlayer } from '@/components/webar-player';
import { getPublishedArCampaignContent } from '@/lib/ar-campaign-store';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const content = await getPublishedArCampaignContent(slug, 'en');

  return {
    title: `${content.app.name} | AR Vision Studio`,
    description: content.app.headline,
    openGraph: {
      title: `${content.app.name} | AR Vision Studio`,
      description: content.app.headline,
      images: content.app.targetImageUrl ? [{ url: content.app.targetImageUrl, alt: content.app.targetImageAlt }] : undefined
    }
  };
}

// /scan always opens the camera. The printed QR codes carry ?mode=video and cannot be reprinted,
// but the flow they are meant to start is QR -> Start camera -> scan the stamp or the pin badge ->
// the video plays on the object, so honouring that parameter here skipped the AR entirely. The
// plain player is still one tap away behind "Watch the video instead", and /player/[slug] remains
// the route that plays the video outright.
export default async function ScanCampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = await getPublishedArCampaignContent(slug, 'en');

  return <WebArPlayer content={content} entryMode="scanner" />;
}

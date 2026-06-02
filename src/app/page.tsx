import type { Metadata } from 'next';
import { WebArPlayer } from '@/components/webar-player';
import { getPublishedArCampaignContent } from '@/lib/ar-campaign-store';

const DEFAULT_CAMPAIGN_SLUG = 'purewells-wacandy-japan';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Frankincense World AR',
  description: 'Open the camera, scan the stamp, and play the AR video experience.'
};

export default async function RootPage() {
  const content = await getPublishedArCampaignContent(DEFAULT_CAMPAIGN_SLUG, 'en');

  return <WebArPlayer content={content} entryMode="scanner" />;
}

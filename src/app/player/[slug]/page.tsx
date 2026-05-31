import { WebArPlayer } from '@/components/webar-player';
import { getPublishedArCampaignContent } from '@/lib/ar-campaign-store';

export const dynamic = 'force-dynamic';

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = await getPublishedArCampaignContent(slug, 'en');

  return <WebArPlayer content={content} entryMode="video" />;
}

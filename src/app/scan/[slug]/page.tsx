import type { Metadata } from 'next';
import { WebArPlayer } from '@/components/webar-player';
import { getPublishedArCampaignContent } from '@/lib/ar-campaign-store';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getEntryMode(searchParams: Record<string, string | string[] | undefined> | undefined) {
  const value = searchParams?.mode;
  const mode = Array.isArray(value) ? value[0] : value;
  return mode === 'video' ? 'video' : 'scanner';
}

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

export default async function ScanCampaignPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams?: SearchParams }) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([params, searchParams ?? Promise.resolve({})]);
  const content = await getPublishedArCampaignContent(slug, 'en');

  return <WebArPlayer content={content} entryMode={getEntryMode(resolvedSearchParams)} />;
}

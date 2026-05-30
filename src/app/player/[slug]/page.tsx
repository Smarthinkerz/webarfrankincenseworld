import { WebArPlayer } from '@/components/webar-player';
import { defaultCmsContent } from '@/lib/cms-defaults';

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = defaultCmsContent('en');
  content.app.slug = slug;
  return <WebArPlayer content={content} />;
}

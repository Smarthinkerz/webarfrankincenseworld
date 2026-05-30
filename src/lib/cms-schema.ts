import type { Locale } from './locales';

export type FeatureCard = { title: string; body: string };
export type MetricCard = { label: string; value: string };
export type ArTrackingMode = 'image-target' | 'manual-preview';
export type ArVideoPlayback = 'autoplay-on-detect' | 'tap-to-play';

export type FrontPageContent = {
  eyebrow: string;
  heroTitle: string;
  heroBody: string;
  primaryCta: string;
  secondaryCta: string;
  metrics: MetricCard[];
  features: FeatureCard[];
};

export type AppExperienceContent = {
  slug: string;
  name: string;
  headline: string;
  instructions: string;
  targetLabel: string;
  trackingMode: ArTrackingMode;
  targetImageUrl: string;
  targetImageAlt: string;
  trackingDataUrl: string;
  videoUrl: string;
  videoPosterUrl: string;
  videoTitle: string;
  videoPlayback: ArVideoPlayback;
  status: 'draft' | 'published';
  overlays: FeatureCard[];
};

export type CmsContent = {
  locale: Locale;
  frontPage: FrontPageContent;
  app: AppExperienceContent;
  updatedAt: string;
};

export type CmsPayload = {
  locale: Locale;
  content: CmsContent;
  publicationStatus: 'draft' | 'published';
};

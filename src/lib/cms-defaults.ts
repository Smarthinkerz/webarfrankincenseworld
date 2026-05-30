import type { CmsContent } from './cms-schema';
import type { Locale } from './locales';

const base = {
  en: {
    eyebrow: 'Enterprise WebAR SaaS',
    heroTitle: 'Launch, manage, and preview premium AR campaigns from one secure studio.',
    heroBody: 'AR Vision Studio combines a multilingual front page, a WebAR player, and an admin CMS so teams can update public messaging and app experiences without engineering handoffs.',
    primaryCta: 'Open WebAR preview',
    secondaryCta: 'Review admin CMS',
    appName: 'Product Launch Portal',
    appHeadline: 'Point your camera at the campaign marker and unlock an interactive product video story.',
    instructions: 'On mobile, open the player, allow camera access, and scan the printed campaign image. The configured video plays when the target is detected.',
    target: 'Campaign marker: ARVS-Launch-01'
  },
  ja: {
    eyebrow: 'エンタープライズ WebAR SaaS',
    heroTitle: '安全なスタジオから高品質なARキャンペーンを公開・管理・プレビュー。',
    heroBody: 'AR Vision Studio は、多言語フロントページ、WebARプレイヤー、管理CMSを統合し、エンジニアを介さずに公開コンテンツとアプリ体験を更新できます。',
    primaryCta: 'WebARプレビューを開く',
    secondaryCta: '管理CMSを確認',
    appName: 'プロダクトローンチポータル',
    appHeadline: 'キャンペーンマーカーにカメラを向けて、商品動画ストーリーを再生します。',
    instructions: 'モバイルでプレイヤーを開き、カメラを許可して印刷されたキャンペーン画像をスキャンします。ターゲット検出時に設定済み動画が再生されます。',
    target: 'キャンペーンマーカー: ARVS-Launch-01'
  },
  ar: {
    eyebrow: 'منصة WebAR للمؤسسات',
    heroTitle: 'أطلق حملات الواقع المعزز وأدرها وعاينها من استوديو آمن واحد.',
    heroBody: 'يجمع AR Vision Studio بين صفحة أمامية متعددة اللغات ومشغل WebAR ونظام إدارة محتوى يمكّن الفرق من تحديث الرسائل العامة وتجارب التطبيق دون انتظار التطوير.',
    primaryCta: 'افتح معاينة WebAR',
    secondaryCta: 'راجع نظام الإدارة',
    appName: 'بوابة إطلاق المنتج',
    appHeadline: 'وجّه الكاميرا إلى علامة الحملة لتشغيل قصة فيديو تفاعلية للمنتج.',
    instructions: 'افتح المشغل على الهاتف، واسمح بالكاميرا، ثم امسح صورة الحملة المطبوعة. يتم تشغيل الفيديو عند اكتشاف الهدف.',
    target: 'علامة الحملة: ARVS-Launch-01'
  }
} as const;

export function defaultCmsContent(locale: Locale): CmsContent {
  const copy = base[locale];
  return {
    locale,
    updatedAt: new Date().toISOString(),
    frontPage: {
      eyebrow: copy.eyebrow,
      heroTitle: copy.heroTitle,
      heroBody: copy.heroBody,
      primaryCta: copy.primaryCta,
      secondaryCta: copy.secondaryCta,
      metrics: [
        { label: 'Languages', value: 'EN · JA · AR' },
        { label: 'Backend', value: 'Supabase' },
        { label: 'Preview', value: 'Live CMS' }
      ],
      features: [
        { title: 'Front-page CMS', body: 'Authorized admins can edit hero copy, CTAs, metrics, and feature sections by locale.' },
        { title: 'WebAR app CMS', body: 'Experience copy, scan targets, video overlays, and app cards can be drafted and previewed.' },
        { title: 'Secure publishing', body: 'Draft and publish operations are designed for Supabase Auth, roles, and RLS.' }
      ]
    },
    app: {
      slug: 'preview',
      name: copy.appName,
      headline: copy.appHeadline,
      instructions: copy.instructions,
      targetLabel: copy.target,
      trackingMode: 'image-target',
      targetImageUrl: '/sample-ar-target.svg',
      targetImageAlt: 'AR Vision Studio sample product-launch target image',
      trackingDataUrl: '',
      videoUrl: '',
      videoPosterUrl: '/sample-video-poster.svg',
      videoTitle: 'Product launch reveal video',
      videoPlayback: 'autoplay-on-detect',
      status: 'published',
      overlays: [
        { title: 'Target image', body: 'Upload or paste the printed image that mobile visitors will scan.' },
        { title: 'Video overlay', body: 'Attach the owned product video that should play after target detection.' },
        { title: 'Tracking dataset', body: 'Production image tracking uses a compiled target file generated from the target image.' }
      ]
    }
  };
}

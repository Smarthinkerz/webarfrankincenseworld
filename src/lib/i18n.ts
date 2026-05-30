import type { Locale } from './locales';

const dictionary = {
  en: {
    navProduct: 'Product', navPlayer: 'WebAR Player', navAdmin: 'Admin CMS', navLogin: 'Login',
    adminLogin: 'Admin login', cmsPreview: 'CMS live preview', health: 'System ready'
  },
  ja: {
    navProduct: '製品', navPlayer: 'WebARプレイヤー', navAdmin: '管理CMS', navLogin: 'ログイン',
    adminLogin: '管理者ログイン', cmsPreview: 'CMSライブプレビュー', health: 'システム準備完了'
  },
  ar: {
    navProduct: 'المنتج', navPlayer: 'مشغل WebAR', navAdmin: 'نظام الإدارة', navLogin: 'تسجيل الدخول',
    adminLogin: 'دخول المدير', cmsPreview: 'معاينة مباشرة للمحتوى', health: 'النظام جاهز'
  }
} satisfies Record<Locale, Record<string, string>>;

export function t(locale: Locale, key: keyof typeof dictionary.en) {
  return dictionary[locale][key] ?? dictionary.en[key];
}

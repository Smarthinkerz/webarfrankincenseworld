import type { Locale } from '@/lib/locales';
import { t } from '@/lib/i18n';
import { ButtonLink } from './button';

export function SiteHeader({ locale }: { locale: Locale }) {
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
      <a href={`/${locale}`} className="flex items-center gap-3" aria-label="AR Vision Studio home">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan font-black text-ink shadow-glow">AR</span>
        <span>
          <span className="block text-sm font-bold tracking-[0.28em] text-white">VISION</span>
          <span className="block text-xs uppercase tracking-[0.34em] text-cyan/80">Studio</span>
        </span>
      </a>
      <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex" aria-label="Primary navigation">
        <a href={`/${locale}#product`} className="hover:text-white">{t(locale, 'navProduct')}</a>
        <a href="/player/preview" className="hover:text-white">{t(locale, 'navPlayer')}</a>
        <a href={`/${locale}/admin/cms-preview`} className="hover:text-white">{t(locale, 'navAdmin')}</a>
      </nav>
      <ButtonLink href={`/${locale}/admin/login`} variant="secondary">{t(locale, 'navLogin')}</ButtonLink>
    </header>
  );
}

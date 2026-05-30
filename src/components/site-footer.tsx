import type { Locale } from '@/lib/locales';

export function SiteFooter({ locale }: { locale: Locale }) {
  return (
    <footer className="mx-auto w-full max-w-7xl px-6 py-10 text-sm text-white/55">
      <div className="glass flex flex-col gap-4 rounded-3xl p-6 md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} AR Vision Studio. Supabase-only architecture, no Firebase.</p>
        <div className="flex gap-4">
          <a href={`/${locale}`} className="hover:text-white">Home</a>
          <a href="/api/health" className="hover:text-white">Health</a>
          <a href="/manifest.webmanifest" className="hover:text-white">PWA Manifest</a>
        </div>
      </div>
    </footer>
  );
}

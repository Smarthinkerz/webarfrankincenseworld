import type { CmsContent } from '@/lib/cms-schema';
import type { Locale } from '@/lib/locales';
import { ButtonLink } from './button';

export function FrontPage({ content, locale }: { content: CmsContent; locale: Locale }) {
  return (
    <main id="product" className="mx-auto w-full max-w-7xl px-6 pb-20 pt-10">
      <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="mb-5 inline-flex rounded-full border border-cyan/30 bg-cyan/10 px-4 py-2 text-sm font-bold uppercase tracking-[0.28em] text-cyan">{content.frontPage.eyebrow}</p>
          <h1 className="max-w-4xl text-5xl font-black leading-tight tracking-[-0.04em] text-white md:text-7xl">{content.frontPage.heroTitle}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70">{content.frontPage.heroBody}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/scan/purewells-wacandy-japan">{content.frontPage.primaryCta}</ButtonLink>
            <ButtonLink href={`/${locale}/admin/cms-preview`} variant="secondary">{content.frontPage.secondaryCta}</ButtonLink>
          </div>
        </div>
        <div className="glass rounded-[2rem] p-5 shadow-glow">
          <div className="rounded-[1.5rem] border border-white/10 bg-black/35 p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan/80">Live Campaign</p>
                <h2 className="mt-1 text-2xl font-bold">{content.app.name}</h2>
              </div>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-200">Published</span>
            </div>
            <div className="grid min-h-80 place-items-center rounded-3xl border border-cyan/20 bg-[radial-gradient(circle,rgba(93,231,255,0.18),transparent_55%)]">
              <div className="h-36 w-36 rounded-[2rem] border border-cyan/50 bg-cyan/10 p-4 shadow-glow">
                <div className="h-full w-full rounded-2xl border border-white/25 bg-white/10" />
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-white/65">{content.app.headline}</p>
          </div>
        </div>
      </section>
      <section className="mt-12 grid gap-4 md:grid-cols-3">
        {content.frontPage.metrics.map((metric) => (
          <div className="glass rounded-3xl p-6" key={`${metric.label}-${metric.value}`}>
            <p className="text-3xl font-black text-white">{metric.value}</p>
            <p className="mt-2 text-sm uppercase tracking-[0.24em] text-white/50">{metric.label}</p>
          </div>
        ))}
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {content.frontPage.features.map((feature) => (
          <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-6" key={feature.title}>
            <h3 className="text-xl font-bold text-white">{feature.title}</h3>
            <p className="mt-3 text-sm leading-6 text-white/60">{feature.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

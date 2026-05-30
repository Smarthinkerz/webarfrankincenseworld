'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Button } from '@/components/button';
import { FrontPage } from '@/components/front-page';
import { WebArPlayer } from '@/components/webar-player';
import type { ArTrackingMode, ArVideoPlayback, CmsContent, FeatureCard, MetricCard } from '@/lib/cms-schema';

type PreviewTarget = 'front-page' | 'app';
type EditorSection = 'overview' | 'front-page' | 'app' | 'ar-media' | 'cards' | 'operations';
type DeviceMode = 'desktop' | 'tablet' | 'mobile';

const editorSections: Array<{ id: EditorSection; label: string; description: string }> = [
  { id: 'overview', label: 'Overview', description: 'CMS status, guardrails, and quick actions' },
  { id: 'front-page', label: 'Front page', description: 'Hero, CTA, and marketing positioning' },
  { id: 'app', label: 'WebAR app', description: 'Experience copy and scanner instructions' },
  { id: 'ar-media', label: 'AR media', description: 'Target image, tracking data, and video overlay' },
  { id: 'cards', label: 'Cards', description: 'Metrics, features, and overlay cards' },
  { id: 'operations', label: 'Operations', description: 'Draft, publish, and release readiness' }
];

const deviceModes: Array<{ id: DeviceMode; label: string; widthClass: string; frameLabel: string }> = [
  { id: 'desktop', label: 'Desktop', widthClass: 'w-full', frameLabel: 'Responsive desktop canvas' },
  { id: 'tablet', label: 'Tablet', widthClass: 'max-w-[820px]', frameLabel: 'Tablet-width canvas' },
  { id: 'mobile', label: 'Mobile', widthClass: 'max-w-[390px]', frameLabel: 'Mobile-width camera canvas' }
];

function updateFeature(items: FeatureCard[], index: number, key: keyof FeatureCard, value: string) {
  return items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item);
}

function updateMetric(items: MetricCard[], index: number, key: keyof MetricCard, value: string) {
  return items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item);
}

function createFeatureCard(): FeatureCard {
  return { title: 'New content block', body: 'Describe the value, instruction, or visual overlay here.' };
}

function createMetricCard(): MetricCard {
  return { label: 'New metric', value: '0' };
}

function getDeviceWidthClass(deviceMode: DeviceMode) {
  return deviceModes.find((mode) => mode.id === deviceMode)?.widthClass ?? 'w-full';
}

function getDeviceLabel(deviceMode: DeviceMode) {
  return deviceModes.find((mode) => mode.id === deviceMode)?.frameLabel ?? 'Responsive preview canvas';
}

export function CmsLiveEditor({ initialContent, reviewMode = false }: { initialContent: CmsContent; reviewMode?: boolean }) {
  const [draft, setDraft] = useState<CmsContent>(initialContent);
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget>('front-page');
  const [activeSection, setActiveSection] = useState<EditorSection>('overview');
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Draft changes update the preview instantly.');
  const payload = useMemo(() => ({ locale: draft.locale, content: { ...draft, updatedAt: new Date().toISOString() } }), [draft]);

  function applyDraft(nextDraft: CmsContent) {
    setDraft({ ...nextDraft, updatedAt: new Date().toISOString() });
    setIsDirty(true);
    setStatus('Unsaved local changes are visible in the preview. Save a draft or publish when ready.');
  }

  function updateAppField<Key extends keyof CmsContent['app']>(key: Key, value: CmsContent['app'][Key]) {
    applyDraft({ ...draft, app: { ...draft.app, [key]: value } });
  }

  async function submit(publicationStatus: 'draft' | 'published') {
    setStatus(publicationStatus === 'published' ? 'Publishing…' : 'Saving draft…');
    const endpoint = publicationStatus === 'published' ? '/api/admin/cms/publish' : '/api/admin/cms/save-draft';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, publicationStatus })
      });
      const data = await response.json() as { message?: string };
      if (response.ok) {
        setIsDirty(false);
        setLastSavedAt(new Date().toLocaleString());
      }
      setStatus(data.message ?? (response.ok ? 'Saved.' : 'Request could not be completed.'));
    } catch {
      setStatus('Network error. Your visible draft is still preserved in this editor session.');
    }
  }

  const targetConfigured = draft.app.targetImageUrl.trim().length > 0;
  const videoConfigured = draft.app.videoUrl.trim().length > 0;
  const trackingConfigured = draft.app.trackingMode === 'manual-preview' || draft.app.trackingDataUrl.trim().length > 0;
  const dashboardStats = [
    { label: 'Locale', value: draft.locale.toUpperCase() },
    { label: 'Front-page metrics', value: String(draft.frontPage.metrics.length) },
    { label: 'Target image', value: targetConfigured ? 'Configured' : 'Needed' },
    { label: 'Video overlay', value: videoConfigured ? 'Configured' : 'Poster only' },
    { label: 'Tracking mode', value: draft.app.trackingMode === 'image-target' ? 'Image target' : 'Manual preview' },
    { label: 'App overlays', value: String(draft.app.overlays.length) }
  ];

  return (
    <main className="mx-auto w-full max-w-[100rem] px-6 py-8">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.32em] text-cyan/80">Admin CMS</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] text-white">Front page and WebAR app live editor</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-white/60">Edit marketing content and the AR image-target-to-video experience from one Supabase-ready workspace. The preview canvas updates immediately, while draft and publish actions remain protected by the existing admin API routes.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setPreviewTarget(previewTarget === 'front-page' ? 'app' : 'front-page')}>Preview: {previewTarget === 'front-page' ? 'Front page' : 'WebAR app'}</Button>
          <Button variant="secondary" disabled={!isDirty} onClick={() => void submit('draft')}>Save draft</Button>
          <Button disabled={!isDirty} onClick={() => void submit('published')}>Publish</Button>
        </div>
      </div>

      {reviewMode ? <p className="mb-5 rounded-3xl border border-cyan/30 bg-cyan/10 p-4 text-sm leading-6 text-cyan/90">Visual review mode is enabled because this sandbox does not have your live Supabase credentials. Production admin access remains protected by Supabase Auth and approved admin roles.</p> : null}

      <div className="grid gap-6 xl:grid-cols-[18rem_34rem_1fr]">
        <aside className="glass h-fit rounded-[2rem] p-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-white/45">Workspace</p>
            <h2 className="mt-2 text-xl font-black text-white">AR Vision Studio</h2>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className={clsx('h-2.5 w-2.5 rounded-full', isDirty ? 'bg-amber-300' : 'bg-emerald-300')} />
              <span className="text-white/65">{isDirty ? 'Unsaved changes' : 'Synced preview state'}</span>
            </div>
          </div>
          <nav className="mt-4 space-y-2">
            {editorSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={clsx('w-full rounded-3xl border px-4 py-3 text-left transition', activeSection === section.id ? 'border-cyan/40 bg-cyan/15 text-white' : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.06]')}
              >
                <span className="block text-sm font-black">{section.label}</span>
                <span className="mt-1 block text-xs leading-5 text-white/45">{section.description}</span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="glass max-h-[calc(100vh-8rem)] overflow-auto rounded-[2rem] p-5">
          {activeSection === 'overview' ? (
            <div>
              <h2 className="text-xl font-black text-white">Control overview</h2>
              <p className="mt-2 text-sm leading-6 text-white/55">The workflow is: add the scan target image, attach the owned video asset, preview the mobile player, then save a draft or publish through the protected Supabase CMS API.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {dashboardStats.map((stat) => (
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4" key={stat.label}>
                    <p className="text-xs uppercase tracking-[0.24em] text-white/40">{stat.label}</p>
                    <p className="mt-2 text-2xl font-black text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
                <h3 className="font-bold text-white">AR publishing rule</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">For a real mobile AR release, the target image must be converted into a tracking dataset by the chosen WebAR engine. This CMS stores the target image URL, tracking dataset URL, and video URL so the player can bind the video overlay to the recognized image target.</p>
              </div>
            </div>
          ) : null}

          {activeSection === 'front-page' ? (
            <div>
              <h2 className="text-xl font-black text-white">Front-page controls</h2>
              <p className="mt-2 text-sm text-white/55">Changes below are reflected live in the public landing-page preview.</p>
              <div className="mt-6 space-y-5">
                <label className="block"><span className="input-label">Front-page eyebrow</span><input className="input-field" value={draft.frontPage.eyebrow} onChange={(event) => applyDraft({ ...draft, frontPage: { ...draft.frontPage, eyebrow: event.target.value } })} /></label>
                <label className="block"><span className="input-label">Hero title</span><textarea className="input-field min-h-28" value={draft.frontPage.heroTitle} onChange={(event) => applyDraft({ ...draft, frontPage: { ...draft.frontPage, heroTitle: event.target.value } })} /></label>
                <label className="block"><span className="input-label">Hero body</span><textarea className="input-field min-h-28" value={draft.frontPage.heroBody} onChange={(event) => applyDraft({ ...draft, frontPage: { ...draft.frontPage, heroBody: event.target.value } })} /></label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block"><span className="input-label">Primary CTA</span><input className="input-field" value={draft.frontPage.primaryCta} onChange={(event) => applyDraft({ ...draft, frontPage: { ...draft.frontPage, primaryCta: event.target.value } })} /></label>
                  <label className="block"><span className="input-label">Secondary CTA</span><input className="input-field" value={draft.frontPage.secondaryCta} onChange={(event) => applyDraft({ ...draft, frontPage: { ...draft.frontPage, secondaryCta: event.target.value } })} /></label>
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === 'app' ? (
            <div>
              <h2 className="text-xl font-black text-white">WebAR app controls</h2>
              <p className="mt-2 text-sm text-white/55">Manage the visitor-facing AR experience copy and scanner guidance.</p>
              <div className="mt-6 space-y-5">
                <label className="block"><span className="input-label">Experience slug</span><input className="input-field" value={draft.app.slug} onChange={(event) => updateAppField('slug', event.target.value)} /></label>
                <label className="block"><span className="input-label">Experience name</span><input className="input-field" value={draft.app.name} onChange={(event) => updateAppField('name', event.target.value)} /></label>
                <label className="block"><span className="input-label">Experience headline</span><textarea className="input-field min-h-24" value={draft.app.headline} onChange={(event) => updateAppField('headline', event.target.value)} /></label>
                <label className="block"><span className="input-label">Instructions</span><textarea className="input-field min-h-24" value={draft.app.instructions} onChange={(event) => updateAppField('instructions', event.target.value)} /></label>
                <label className="block"><span className="input-label">Target label</span><input className="input-field" value={draft.app.targetLabel} onChange={(event) => updateAppField('targetLabel', event.target.value)} /></label>
              </div>
            </div>
          ) : null}

          {activeSection === 'ar-media' ? (
            <div>
              <h2 className="text-xl font-black text-white">AR target image and video overlay</h2>
              <p className="mt-2 text-sm leading-6 text-white/55">This is where the admin pairs the image that mobile users scan with the video that should play after detection. Use only media you own or have rights to publish.</p>
              <div className="mt-6 space-y-5">
                <div className="rounded-3xl border border-cyan/25 bg-cyan/10 p-4">
                  <h3 className="font-bold text-cyan">Authoring sequence</h3>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-cyan/85">
                    <li>Upload or paste the public URL for the printed target image.</li>
                    <li>Generate or attach the image-tracking dataset required by the selected AR engine.</li>
                    <li>Upload or paste the public URL for the owned video overlay.</li>
                    <li>Switch the preview to mobile and confirm the visitor instructions are clear.</li>
                  </ol>
                </div>
                <label className="block"><span className="input-label">Tracking mode</span><select className="input-field" value={draft.app.trackingMode} onChange={(event) => updateAppField('trackingMode', event.target.value as ArTrackingMode)}><option value="image-target">Image target detection</option><option value="manual-preview">Manual preview / no camera tracking</option></select></label>
                <label className="block"><span className="input-label">Target image URL</span><input className="input-field" placeholder="https://.../target-image.png" value={draft.app.targetImageUrl} onChange={(event) => updateAppField('targetImageUrl', event.target.value)} /></label>
                <label className="block"><span className="input-label">Target image alt text</span><input className="input-field" value={draft.app.targetImageAlt} onChange={(event) => updateAppField('targetImageAlt', event.target.value)} /></label>
                <label className="block"><span className="input-label">Compiled tracking dataset URL</span><input className="input-field" placeholder="https://.../target.mind or engine-specific target file" value={draft.app.trackingDataUrl} onChange={(event) => updateAppField('trackingDataUrl', event.target.value)} /></label>
                <label className="block"><span className="input-label">Video overlay URL</span><input className="input-field" placeholder="https://.../launch-video.mp4" value={draft.app.videoUrl} onChange={(event) => updateAppField('videoUrl', event.target.value)} /></label>
                <label className="block"><span className="input-label">Video poster URL</span><input className="input-field" value={draft.app.videoPosterUrl} onChange={(event) => updateAppField('videoPosterUrl', event.target.value)} /></label>
                <label className="block"><span className="input-label">Video title</span><input className="input-field" value={draft.app.videoTitle} onChange={(event) => updateAppField('videoTitle', event.target.value)} /></label>
                <label className="block"><span className="input-label">Playback behavior</span><select className="input-field" value={draft.app.videoPlayback} onChange={(event) => updateAppField('videoPlayback', event.target.value as ArVideoPlayback)}><option value="autoplay-on-detect">Autoplay when target is detected</option><option value="tap-to-play">Ask visitor to tap after detection</option></select></label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className={clsx('rounded-3xl border p-4', targetConfigured ? 'border-emerald-300/30 bg-emerald-300/10' : 'border-amber-300/30 bg-amber-300/10')}><p className="text-xs uppercase tracking-[0.2em] text-white/45">Target image</p><p className="mt-2 text-sm font-bold text-white">{targetConfigured ? 'Ready' : 'Required'}</p></div>
                  <div className={clsx('rounded-3xl border p-4', trackingConfigured ? 'border-emerald-300/30 bg-emerald-300/10' : 'border-amber-300/30 bg-amber-300/10')}><p className="text-xs uppercase tracking-[0.2em] text-white/45">Tracking file</p><p className="mt-2 text-sm font-bold text-white">{trackingConfigured ? 'Ready' : 'Required'}</p></div>
                  <div className={clsx('rounded-3xl border p-4', videoConfigured ? 'border-emerald-300/30 bg-emerald-300/10' : 'border-amber-300/30 bg-amber-300/10')}><p className="text-xs uppercase tracking-[0.2em] text-white/45">Video</p><p className="mt-2 text-sm font-bold text-white">{videoConfigured ? 'Ready' : 'Poster preview'}</p></div>
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === 'cards' ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black text-white">Cards and overlays</h2>
                <p className="mt-2 text-sm leading-6 text-white/55">Manage reusable content blocks without changing the database or routing model.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-white">Front-page metrics</h3>
                  <Button className="px-4 py-2" variant="secondary" onClick={() => applyDraft({ ...draft, frontPage: { ...draft.frontPage, metrics: [...draft.frontPage.metrics, createMetricCard()] } })}>Add metric</Button>
                </div>
                <div className="mt-4 space-y-4">
                  {draft.frontPage.metrics.map((metric, index) => (
                    <div className="grid gap-3 rounded-2xl border border-white/10 p-3 sm:grid-cols-2" key={`${metric.label}-${index}`}>
                      <input className="input-field" value={metric.value} onChange={(event) => applyDraft({ ...draft, frontPage: { ...draft.frontPage, metrics: updateMetric(draft.frontPage.metrics, index, 'value', event.target.value) } })} />
                      <input className="input-field" value={metric.label} onChange={(event) => applyDraft({ ...draft, frontPage: { ...draft.frontPage, metrics: updateMetric(draft.frontPage.metrics, index, 'label', event.target.value) } })} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-white">Front-page feature cards</h3>
                  <Button className="px-4 py-2" variant="secondary" onClick={() => applyDraft({ ...draft, frontPage: { ...draft.frontPage, features: [...draft.frontPage.features, createFeatureCard()] } })}>Add feature</Button>
                </div>
                <div className="mt-4 space-y-4">
                  {draft.frontPage.features.map((feature, index) => (
                    <div className="rounded-2xl border border-white/10 p-3" key={`${feature.title}-${index}`}>
                      <input className="input-field" value={feature.title} onChange={(event) => applyDraft({ ...draft, frontPage: { ...draft.frontPage, features: updateFeature(draft.frontPage.features, index, 'title', event.target.value) } })} />
                      <textarea className="input-field min-h-20" value={feature.body} onChange={(event) => applyDraft({ ...draft, frontPage: { ...draft.frontPage, features: updateFeature(draft.frontPage.features, index, 'body', event.target.value) } })} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-white">WebAR overlay cards</h3>
                  <Button className="px-4 py-2" variant="secondary" onClick={() => applyDraft({ ...draft, app: { ...draft.app, overlays: [...draft.app.overlays, createFeatureCard()] } })}>Add overlay</Button>
                </div>
                <div className="mt-4 space-y-4">
                  {draft.app.overlays.map((overlay, index) => (
                    <div className="rounded-2xl border border-white/10 p-3" key={`${overlay.title}-${index}`}>
                      <input className="input-field" value={overlay.title} onChange={(event) => applyDraft({ ...draft, app: { ...draft.app, overlays: updateFeature(draft.app.overlays, index, 'title', event.target.value) } })} />
                      <textarea className="input-field min-h-20" value={overlay.body} onChange={(event) => applyDraft({ ...draft, app: { ...draft.app, overlays: updateFeature(draft.app.overlays, index, 'body', event.target.value) } })} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === 'operations' ? (
            <div>
              <h2 className="text-xl font-black text-white">Operations</h2>
              <p className="mt-2 text-sm leading-6 text-white/55">Draft and publish requests are sent through the existing protected API routes. Editors may save drafts; publishing requires an approved admin or super-admin profile.</p>
              <div className="mt-6 space-y-4">
                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/40">Current status</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">{status}</p>
                  <p className="mt-2 text-xs text-white/40">Last successful save: {lastSavedAt ?? 'Not saved in this session'}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button variant="secondary" disabled={!isDirty} onClick={() => void submit('draft')}>Save as draft</Button>
                  <Button disabled={!isDirty} onClick={() => void submit('published')}>Publish live</Button>
                </div>
              </div>
            </div>
          ) : null}

          <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/65">{status}</p>
        </section>

        <section className="min-h-[72vh] overflow-hidden rounded-[2rem] border border-white/10 bg-black/30">
          <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.28em] text-white/55">Live preview canvas</p>
              <p className="mt-1 text-xs text-white/40">{getDeviceLabel(deviceMode)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {deviceModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setDeviceMode(mode.id)}
                  className={clsx('rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition', deviceMode === mode.id ? 'border-cyan/40 bg-cyan/15 text-cyan' : 'border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white')}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[calc(100vh-10rem)] overflow-auto p-4">
            <div className={clsx('mx-auto overflow-hidden rounded-[1.5rem] border border-white/10 bg-ink shadow-2xl transition-all', getDeviceWidthClass(deviceMode))}>
              {previewTarget === 'front-page' ? <FrontPage content={draft} locale={draft.locale} /> : <WebArPlayer content={draft} />}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

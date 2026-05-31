'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from 'react';
import type { CmsContent } from '@/lib/cms-schema';

const AFRAME_SCRIPT_ID = 'aframe-runtime-script';
const MINDAR_SCRIPT_ID = 'mindar-image-aframe-runtime-script';
const AFRAME_SCRIPT_SRC = 'https://aframe.io/releases/1.5.0/aframe.min.js';
const MINDAR_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js';
const AR_VIDEO_OVERLAY_WIDTH = 1.45;
const AR_VIDEO_OVERLAY_HEIGHT = 0.815625;

type WebArEntryMode = 'scanner' | 'video';

function hasValue(value: string) {
  return value.trim().length > 0;
}

function loadScript(id: string, src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === 'true') {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
    document.head.appendChild(script);
  });
}

export function WebArPlayer({ content, entryMode = 'scanner' }: { content: CmsContent; entryMode?: WebArEntryMode }) {
  const targetImageUrl = hasValue(content.app.targetImageUrl) ? content.app.targetImageUrl : '/sample-ar-target.svg';
  const posterUrl = hasValue(content.app.videoPosterUrl) ? content.app.videoPosterUrl : '/sample-video-poster.svg';
  const hasVideo = hasValue(content.app.videoUrl);
  const hasTrackingData = content.app.trackingMode === 'manual-preview' || hasValue(content.app.trackingDataUrl);
  const trackingLabel = content.app.trackingMode === 'image-target' ? 'Image target detection' : 'Manual preview mode';
  const opensInVideoMode = entryMode === 'video' && hasVideo;
  const [scannerRequested, setScannerRequested] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [targetDetected, setTargetDetected] = useState(false);
  const [videoSoundEnabled, setVideoSoundEnabled] = useState(false);
  const [status, setStatus] = useState(
    opensInVideoMode
      ? 'The Purewells video is ready. If it does not start automatically, tap Play once.'
      : 'Open this URL on your phone, tap Start camera, then point the camera at the printed target image.'
  );
  const canRunCameraScanner = content.app.trackingMode === 'image-target' && hasTrackingData && hasVideo;
  const targetMindSrc = content.app.trackingDataUrl;
  const sceneConfig = useMemo(
    () => `imageTargetSrc: ${targetMindSrc}; autoStart: true; uiScanning: yes; uiLoading: yes; uiError: yes; filterMinCF: 0.0001; filterBeta: 0.001; warmupTolerance: 5; missTolerance: 5`,
    [targetMindSrc]
  );
  const showDirectVideo = opensInVideoMode && !runtimeReady;

  useEffect(() => {
    if (!scannerRequested || !canRunCameraScanner) return;
    let cancelled = false;

    loadScript(AFRAME_SCRIPT_ID, AFRAME_SCRIPT_SRC)
      .then(() => loadScript(MINDAR_SCRIPT_ID, MINDAR_SCRIPT_SRC))
      .then(() => {
        if (cancelled) return;
        setRuntimeReady(true);
        setStatus('Camera scanner is ready. Keep the printed target inside the frame.');
      })
      .catch(() => {
        if (cancelled) return;
        setRuntimeReady(false);
        setStatus('The browser could not load the WebAR scanner runtime. Refresh the page on mobile and try again.');
      });

    return () => {
      cancelled = true;
    };
  }, [canRunCameraScanner, scannerRequested]);

  useEffect(() => {
    if (!runtimeReady || !scannerRequested) return;

    const targetEntity = document.getElementById('purewells-ar-target');
    const video = document.getElementById('purewells-ar-video') as HTMLVideoElement | null;
    if (!targetEntity || !video) return;

    const handleTargetFound = () => {
      const shouldStartMuted = content.app.videoPlayback === 'autoplay-on-detect' && !videoSoundEnabled;

      setTargetDetected(true);
      setStatus(
        shouldStartMuted
          ? 'Target detected. Video is playing over the image; tap Enable sound once for the music background.'
          : 'Target detected. Playing the Purewells video with sound over the image.'
      );
      video.currentTime = 0;
      video.volume = 1;
      video.muted = shouldStartMuted;
      const playback = video.play();
      if (playback) {
        playback.catch(() => {
          setStatus('Target detected. Tap Enable sound once to allow video playback on this browser.');
        });
      }
    };

    const handleTargetLost = () => {
      setTargetDetected(false);
      setStatus('Target lost. Point the camera back at the printed target image to resume the video overlay.');
      video.pause();
    };

    targetEntity.addEventListener('targetFound', handleTargetFound);
    targetEntity.addEventListener('targetLost', handleTargetLost);

    return () => {
      targetEntity.removeEventListener('targetFound', handleTargetFound);
      targetEntity.removeEventListener('targetLost', handleTargetLost);
    };
  }, [content.app.videoPlayback, runtimeReady, scannerRequested, videoSoundEnabled]);

  useEffect(() => {
    if (!runtimeReady || !scannerRequested) return;

    const scannerRoot = document.getElementById('purewells-scanner-stage');
    const scene = document.getElementById('purewells-ar-scene') as HTMLElement | null;
    if (!scannerRoot || !scene) return;

    const normalizeCameraPreview = () => {
      Object.assign(scene.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'transparent',
        zIndex: '10',
      });

      const canvas = scene.querySelector('canvas') as HTMLCanvasElement | null;
      if (canvas) {
        Object.assign(canvas.style, {
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
          background: 'transparent',
          zIndex: '2',
        });
      }

      const cameraVideos = Array.from(scannerRoot.querySelectorAll('video')).filter(
        (video) => !['purewells-ar-video', 'purewells-direct-video'].includes(video.id)
      );

      cameraVideos.forEach((cameraVideo) => {
        Object.assign(cameraVideo.style, {
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
          maxWidth: 'none',
          maxHeight: 'none',
          objectFit: 'cover',
          background: 'transparent',
          display: 'block',
          zIndex: '1',
        });
      });
    };

    const frame = window.requestAnimationFrame(normalizeCameraPreview);
    const interval = window.setInterval(normalizeCameraPreview, 250);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 6000);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [runtimeReady, scannerRequested]);

  const handleStartScanner = () => {
    if (!canRunCameraScanner) {
      setStatus('Camera scanner cannot start until both the video and tracking dataset are available.');
      return;
    }
    setStatus('Loading camera scanner. If prompted, allow camera access.');
    setVideoSoundEnabled(false);
    setScannerRequested(true);
  };

  const handleVideoTap = () => {
    const directVideo = document.getElementById('purewells-direct-video') as HTMLVideoElement | null;
    if (directVideo) {
      directVideo.muted = false;
      directVideo.volume = 1;
      directVideo.play().then(() => setStatus('Video playback started with sound.')).catch(() => setStatus('Playback is still blocked by the browser. Tap the visible Play button once.'));
      return;
    }

    if (runtimeReady && scannerRequested && !targetDetected) {
      setStatus('The camera scanner is running, but the image target is not detected yet. Keep the exact Owa Stamp EXPO image flat, bright, and fully inside the camera frame.');
      return;
    }

    const arVideo = document.getElementById('purewells-ar-video') as HTMLVideoElement | null;
    if (!arVideo) return;
    arVideo.muted = false;
    arVideo.volume = 1;
    setVideoSoundEnabled(true);
    arVideo.play().then(() => setStatus('Target detected. Sound is enabled and the video is playing over the image.')).catch(() => setStatus('Target detected, but playback is still blocked by the browser. Tap Enable sound once more.'));
  };

  const primaryStateLabel = targetDetected ? 'Target detected' : showDirectVideo ? 'Video ready' : canRunCameraScanner ? 'Ready for camera scan' : hasVideo ? 'Tracking data missing' : 'Video not yet uploaded';

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.32em] text-cyan/80">Purewells campaign experience</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.03em] text-white">{content.app.name}</h1>
        </div>
        <a className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white/75 hover:text-white" href={`/${content.locale}`}>Back to front page</a>
      </div>
      <section className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="glass relative min-h-[70vh] overflow-hidden rounded-[2rem] p-5 shadow-glow">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(93,231,255,0.20),transparent_35%),linear-gradient(135deg,rgba(139,92,246,0.12),transparent)]" />
          <div className="relative grid min-h-[64vh] gap-5 rounded-[1.5rem] border border-white/10 bg-black/35 p-4 lg:grid-cols-[0.72fr_1.28fr] lg:place-items-center">
            <div className="w-full rounded-[1.5rem] border border-cyan/25 bg-black/35 p-4 shadow-glow">
              <p className="text-xs font-bold uppercase tracking-[0.26em] text-cyan/75">Scan target</p>
              <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-white p-3">
                <img className="aspect-square w-full object-cover" src={targetImageUrl} alt={content.app.targetImageAlt || content.app.targetLabel} />
              </div>
              <p className="mt-4 text-sm font-bold text-cyan">{content.app.targetLabel}</p>
              <p className="mt-2 text-xs leading-5 text-white/55">{trackingLabel}{hasTrackingData ? ' is configured for this experience.' : ' still needs a compiled tracking dataset before production camera detection.'}</p>
            </div>

            <div className="w-full text-center">
              <div className="mx-auto overflow-hidden rounded-[1.75rem] border border-white/10 bg-ink/90 shadow-2xl">
                <div className="border-b border-white/10 bg-white/[0.04] px-4 py-3 text-left">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/45">{showDirectVideo ? 'Campaign video' : 'Camera scanner'}</p>
                  <h2 className="mt-1 text-lg font-black text-white">{content.app.videoTitle}</h2>
                </div>
                <div id="purewells-scanner-stage" className="relative aspect-[9/14] min-h-[30rem] bg-black" onClick={handleVideoTap} role="presentation">
                  {runtimeReady && scannerRequested ? (
                    <a-scene
                      id="purewells-ar-scene"
                      key={targetMindSrc}
                      mindar-image={sceneConfig}
                      color-space="sRGB"
                      renderer="alpha: true; colorManagement: true; physicallyCorrectLights: true; antialias: true"
                      vr-mode-ui="enabled: false"
                      device-orientation-permission-ui="enabled: false"
                      embedded
                      className="absolute inset-0 z-10 h-full w-full bg-transparent"
                    >
                      <a-assets>
                        <video id="purewells-ar-video" src={content.app.videoUrl} poster={posterUrl} preload="auto" playsInline crossOrigin="anonymous" muted={content.app.videoPlayback === 'autoplay-on-detect' && !videoSoundEnabled} />
                      </a-assets>
                      <a-camera position="0 0 0" look-controls="enabled: false" />
                      <a-entity id="purewells-ar-target" mindar-image-target="targetIndex: 0">
                        <a-video src="#purewells-ar-video" position="0 0 0.01" width={AR_VIDEO_OVERLAY_WIDTH} height={AR_VIDEO_OVERLAY_HEIGHT} rotation="0 0 0" material="shader: flat" />
                      </a-entity>
                    </a-scene>
                  ) : showDirectVideo ? (
                    <video
                      id="purewells-direct-video"
                      className="absolute inset-0 h-full w-full bg-black object-contain"
                      src={content.app.videoUrl}
                      poster={posterUrl}
                      controls
                      autoPlay
                      muted
                      playsInline
                      preload="auto"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <img className="absolute inset-0 h-full w-full object-cover opacity-55" src={posterUrl} alt={`${content.app.videoTitle} poster`} />
                  )}
                  <div className="absolute inset-x-4 bottom-4 z-20 rounded-2xl border border-cyan/25 bg-black/75 p-3 text-left backdrop-blur">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan">{primaryStateLabel}</p>
                    <p className="mt-1 text-xs leading-5 text-white/70">{status}</p>
                    {!scannerRequested && canRunCameraScanner && (
                      <button type="button" onClick={handleStartScanner} className="mt-3 rounded-full bg-cyan px-5 py-2 text-xs font-black uppercase tracking-[0.18em] text-ink hover:bg-white">
                        {showDirectVideo ? 'Open AR scanner' : 'Start camera'}
                      </button>
                    )}
                    {targetDetected && !videoSoundEnabled && (
                      <button type="button" onClick={(event) => { event.stopPropagation(); handleVideoTap(); }} className="mt-3 rounded-full bg-white px-5 py-2 text-xs font-black uppercase tracking-[0.18em] text-ink hover:bg-cyan">
                        Enable sound
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <h3 className="mt-8 text-3xl font-black tracking-[-0.02em]">{content.app.headline}</h3>
              <p className="mx-auto mt-4 max-w-xl text-white/65">{opensInVideoMode ? 'This QR entry opens the campaign video first. Use Open AR scanner if you want to test target-image camera detection.' : content.app.instructions}</p>
            </div>
          </div>
        </div>
        <aside className="space-y-4">
          <article className="glass rounded-3xl p-5">
            <h3 className="text-lg font-bold text-white">How users open this AR campaign</h3>
            <p className="mt-2 text-sm leading-6 text-white/60">Use a QR code, NFC tag, or shared link to open this WebAR page in Chrome, Edge, or Safari first, then tap Start camera and scan the printed target image inside the page. A phone camera cannot launch WebAR from the image target alone; browser camera access must start inside the page.</p>
            {(!hasTrackingData || !hasVideo) && (
              <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Production asset checklist</p>
                <p className="mt-2 text-xs leading-5 text-amber-50/75">{!hasTrackingData && !hasVideo ? 'Tracking data and video are still pending.' : !hasTrackingData ? 'Tracking data is still pending.' : 'Video is still pending.'} The page stays usable for preview and will automatically use the configured assets once they are available.</p>
              </div>
            )}
          </article>
          {content.app.overlays.map((overlay) => (
            <article className="glass rounded-3xl p-5" key={overlay.title}>
              <h3 className="text-lg font-bold text-white">{overlay.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/60">{overlay.body}</p>
            </article>
          ))}
        </aside>
      </section>
    </main>
  );
}

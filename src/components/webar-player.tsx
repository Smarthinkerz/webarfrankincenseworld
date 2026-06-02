'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CmsContent } from '@/lib/cms-schema';

const AFRAME_SCRIPT_ID = 'aframe-runtime-script';
const MINDAR_SCRIPT_ID = 'mindar-image-aframe-runtime-script';
const AFRAME_SCRIPT_SRC = 'https://aframe.io/releases/1.5.0/aframe.min.js';
const MINDAR_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js';
const AR_VIDEO_OVERLAY_WIDTH = 2.05;
const AR_VIDEO_OVERLAY_HEIGHT = 1.153125;

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
  const opensInVideoMode = entryMode === 'video' && hasVideo;
  const [scannerRequested, setScannerRequested] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [targetDetected, setTargetDetected] = useState(false);
  const [videoSoundEnabled, setVideoSoundEnabled] = useState(false);
  const videoSoundEnabledRef = useRef(false);
  const [status, setStatus] = useState(
    opensInVideoMode
      ? 'Video is ready. Tap once if your browser blocks playback.'
      : 'Tap Start camera, allow camera access, then scan the stamp.'
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
        setStatus('Camera is ready. Keep the stamp flat and inside the frame.');
      })
      .catch(() => {
        if (cancelled) return;
        setRuntimeReady(false);
        setStatus('The scanner could not load. Refresh on your phone and try again.');
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
      const shouldStartMuted = content.app.videoPlayback === 'autoplay-on-detect' && !videoSoundEnabledRef.current;

      setTargetDetected(true);
      setStatus(shouldStartMuted ? 'Stamp detected. Video is playing. Tap Enable sound for audio.' : 'Stamp detected. Video is playing with sound.');
      video.currentTime = 0;
      video.volume = 1;
      video.muted = shouldStartMuted;
      const playback = video.play();
      if (playback) {
        playback.catch(() => {
          setStatus('Stamp detected. Tap Enable sound once to allow playback on this phone.');
        });
      }
    };

    const handleTargetLost = () => {
      setTargetDetected(false);
      setStatus('Point the camera back at the stamp to resume the video.');
      video.pause();
    };

    targetEntity.addEventListener('targetFound', handleTargetFound);
    targetEntity.addEventListener('targetLost', handleTargetLost);

    return () => {
      targetEntity.removeEventListener('targetFound', handleTargetFound);
      targetEntity.removeEventListener('targetLost', handleTargetLost);
    };
  }, [content.app.videoPlayback, runtimeReady, scannerRequested]);

  useEffect(() => {
    if (!runtimeReady || !scannerRequested) return;

    const scannerRoot = document.getElementById('purewells-scanner-stage');
    const scene = document.getElementById('purewells-ar-scene') as HTMLElement | null;
    if (!scannerRoot || !scene) return;

    const normalizeCameraPreview = () => {
      Object.assign(scene.style, {
        position: 'absolute',
        inset: '0',
        width: '100vw',
        height: '100dvh',
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
      setStatus('This AR scan is not ready yet because the video or tracking data is missing.');
      return;
    }
    setStatus('Loading camera. If prompted, allow camera access.');
    videoSoundEnabledRef.current = false;
    setVideoSoundEnabled(false);
    setScannerRequested(true);
  };

  const handleVideoTap = () => {
    const directVideo = document.getElementById('purewells-direct-video') as HTMLVideoElement | null;
    if (directVideo) {
      directVideo.muted = false;
      directVideo.volume = 1;
      videoSoundEnabledRef.current = true;
      setVideoSoundEnabled(true);
      directVideo.play().then(() => setStatus('Video playback started with sound.')).catch(() => setStatus('Tap the visible Play button once to start sound.'));
      return;
    }

    if (runtimeReady && scannerRequested && !targetDetected) {
      setStatus('Scanner is running. Keep the stamp flat, bright, and fully inside the camera frame.');
      return;
    }

    const arVideo = document.getElementById('purewells-ar-video') as HTMLVideoElement | null;
    if (!arVideo) return;
    arVideo.muted = false;
    arVideo.volume = 1;
    videoSoundEnabledRef.current = true;
    setVideoSoundEnabled(true);
    arVideo.play().then(() => setStatus('Sound is enabled. Keep scanning the stamp.')).catch(() => setStatus('Tap Enable sound once more if this phone blocks audio.'));
  };

  const primaryStateLabel = targetDetected ? 'Stamp detected' : scannerRequested ? 'Scanning stamp' : canRunCameraScanner ? 'Ready to scan' : hasVideo ? 'Tracking missing' : 'Video missing';

  return (
    <main className="fixed inset-0 h-[100dvh] w-screen overflow-hidden bg-black text-white">
      <div id="purewells-scanner-stage" className="absolute inset-0 h-full w-full overflow-hidden bg-black" onClick={handleVideoTap} role="presentation">
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
              <video id="purewells-ar-video" src={content.app.videoUrl} poster={posterUrl} preload="auto" playsInline crossOrigin="anonymous" muted={content.app.videoPlayback === 'autoplay-on-detect'} />
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
          <>
            <img className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-md" src={targetImageUrl || posterUrl} alt="Frankincense World AR background" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/35 to-black/85" />
          </>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/80 to-transparent px-5 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-full border border-white/15 bg-black/45 px-4 py-3 backdrop-blur-md">
            <div>
              <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-cyan">Frankincense World AR</p>
              <p className="mt-1 text-xs font-semibold text-white/75">{primaryStateLabel}</p>
            </div>
            <div className={`h-3 w-3 rounded-full ${targetDetected ? 'bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]' : scannerRequested ? 'bg-cyan shadow-[0_0_18px_rgba(93,231,255,0.8)]' : 'bg-white/50'}`} />
          </div>
        </div>

        {!scannerRequested && !showDirectVideo && (
          <div className="absolute inset-0 z-40 flex items-center justify-center px-6 py-10">
            <div className="w-full max-w-sm rounded-[2rem] border border-white/15 bg-black/72 p-6 text-center shadow-2xl backdrop-blur-xl">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan">Scan the stamp</p>
              <h1 className="mt-4 text-3xl font-black leading-tight tracking-[-0.04em] text-white">Open camera and scan</h1>
              <p className="mt-4 text-sm leading-6 text-white/70">Tap Start camera, allow camera access, then point your phone at the stamp. The video will play on the stamp.</p>
              <button type="button" onClick={handleStartScanner} className="mt-6 w-full rounded-full bg-cyan px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-ink shadow-[0_0_28px_rgba(93,231,255,0.45)] transition hover:bg-white">
                Start camera
              </button>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 to-transparent px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-12">
          <div className="mx-auto max-w-xl rounded-3xl border border-white/15 bg-black/62 p-4 text-left backdrop-blur-md">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan">{primaryStateLabel}</p>
            <p className="mt-1 text-sm leading-5 text-white/80">{status}</p>
            {targetDetected && !videoSoundEnabled && (
              <button type="button" onClick={(event) => { event.stopPropagation(); handleVideoTap(); }} className="pointer-events-auto mt-3 w-full rounded-full bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-ink hover:bg-cyan">
                Enable sound / サウンドON
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

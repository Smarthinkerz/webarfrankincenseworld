'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CmsContent } from '@/lib/cms-schema';

const AFRAME_SCRIPT_ID = 'aframe-runtime-script';
const MINDAR_SCRIPT_ID = 'mindar-image-aframe-runtime-script';
const AFRAME_SCRIPT_SRC = 'https://aframe.io/releases/1.4.2/aframe.min.js';
const MINDAR_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js';
const AR_VIDEO_OVERLAY_WIDTH = 2.05;
const AR_VIDEO_OVERLAY_HEIGHT = 1.153125;

type WebArEntryMode = 'scanner' | 'video';

// Instagram / Facebook / LINE / TikTok in-app webviews either block getUserMedia outright or
// silently return no camera. There is no way to request permission from inside them, so the only
// real fix is to reopen the link in Chrome or Safari. Detect them so we can say that plainly.
function detectInAppBrowser(): string | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return 'Facebook';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/Line\//i.test(ua)) return 'LINE';
  if (/WhatsApp/i.test(ua)) return 'WhatsApp';
  if (/TikTok|BytedanceWebview/i.test(ua)) return 'TikTok';
  if (/Twitter/i.test(ua)) return 'X';
  return null;
}

// Minimal structural types for the bits of three.js/A-Frame we touch at runtime.
type Vec3Like = { copy: (v: Vec3Like) => void; lerp: (v: Vec3Like, alpha: number) => void };
type QuatLike = { copy: (q: QuatLike) => void; slerp: (q: QuatLike, alpha: number) => void };
type Mat4Like = {
  decompose: (p: Vec3Like, q: QuatLike, s: Vec3Like) => void;
  compose: (p: Vec3Like, q: QuatLike, s: Vec3Like) => void;
};
type Object3DLike = { visible: boolean; matrix: Mat4Like; matrixAutoUpdate: boolean };
type AnchorElement = HTMLElement & { object3D?: Object3DLike };

type AframeGlobal = {
  components: Record<string, unknown>;
  registerComponent: (name: string, definition: Record<string, unknown>) => void;
  THREE: {
    Vector3: new (x?: number, y?: number, z?: number) => Vec3Like;
    Quaternion: new () => QuatLike;
  };
};

type DampedAnchor = {
  data: { target: string; position: number; rotation: number; scale: number };
  el: HTMLElement & { object3D: Object3DLike };
  pos: Vec3Like; quat: QuatLike; scl: Vec3Like;
  tPos: Vec3Like; tQuat: QuatLike; tScl: Vec3Like;
  settled: boolean;
};

// MindAR writes the tracked pose straight into el.object3D.matrix (matrixAutoUpdate is off), so
// the anchor snaps to whatever the tracker reports each frame. Its own one-euro filter is already
// near its useful limit; pushing it further just makes the overlay lag until the tracker drops and
// snaps back. Instead the anchors stay raw and the video renders on a separate entity that eases
// toward the anchor's decomposed transform. Rotation is damped hardest because angular jitter is
// what the eye actually sees on a plane wider than the target itself. Detection never sees this,
// so extra damping here cannot cause a lost target.
let dampedAnchorRegistered = false;

function registerDampedAnchor() {
  const aframe = (window as unknown as { AFRAME?: AframeGlobal }).AFRAME;
  if (!aframe || dampedAnchorRegistered || aframe.components['damped-anchor']) return;
  dampedAnchorRegistered = true;
  const THREE = aframe.THREE;

  aframe.registerComponent('damped-anchor', {
    schema: {
      target: { type: 'string' },
      position: { type: 'number', default: 0.18 },
      rotation: { type: 'number', default: 0.09 },
      scale: { type: 'number', default: 0.12 }
    },
    init(this: DampedAnchor) {
      this.pos = new THREE.Vector3();
      this.quat = new THREE.Quaternion();
      this.scl = new THREE.Vector3(1, 1, 1);
      this.tPos = new THREE.Vector3();
      this.tQuat = new THREE.Quaternion();
      this.tScl = new THREE.Vector3(1, 1, 1);
      this.settled = false;
      this.el.object3D.matrixAutoUpdate = false;
    },
    tick(this: DampedAnchor) {
      const src = (document.getElementById(this.data.target) as AnchorElement | null)?.object3D;
      const dst = this.el.object3D;
      if (!src) return;

      dst.visible = src.visible;
      if (!src.visible) {
        // Re-seed on the next acquisition so the overlay never eases in from a stale pose.
        this.settled = false;
        return;
      }

      src.matrix.decompose(this.tPos, this.tQuat, this.tScl);

      if (!this.settled) {
        this.pos.copy(this.tPos);
        this.quat.copy(this.tQuat);
        this.scl.copy(this.tScl);
        this.settled = true;
      } else {
        this.pos.lerp(this.tPos, this.data.position);
        this.quat.slerp(this.tQuat, this.data.rotation);
        this.scl.lerp(this.tScl, this.data.scale);
      }

      dst.matrix.compose(this.pos, this.quat, this.scl);
    }
  });
}

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
  const inAppBrowser = useMemo(() => detectInAppBrowser(), []);
  const debugMode = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'),
    []
  );
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const playErrorRef = useRef<string>('none');
  const eventLogRef = useRef<string[]>([]);
  const canRunCameraScanner = content.app.trackingMode === 'image-target' && hasTrackingData && hasVideo;
  const targetMindSrc = content.app.trackingDataUrl;
  const sceneConfig = useMemo(
    () =>
      // One-euro filter: cutoff = filterMinCF + filterBeta * |velocity|.
      // MindAR defaults (0.001 / 1000) let hand tremor through almost unfiltered, which is the
      // shaky overlay. With beta near zero the cutoff stays at filterMinCF regardless of motion,
      // so the pose is heavily damped and the overlay sits still; warmupTolerance above the default 5
      // stops the overlay popping in on a single noisy frame, and a high missTolerance keeps it
      // from flickering out during brief occlusion.
      `imageTargetSrc: ${targetMindSrc}; autoStart: true; uiScanning: yes; uiLoading: yes; uiError: yes; filterMinCF: 0.0001; filterBeta: 1; warmupTolerance: 5; missTolerance: 50`,
    [targetMindSrc]
  );
  const showDirectVideo = opensInVideoMode && !runtimeReady;

  useEffect(() => {
    if (!scannerRequested || !canRunCameraScanner) return;
    let cancelled = false;

    // Request camera permission first, then load AR scripts.
    // If the pre-check fails for any reason other than explicit denial,
    // proceed anyway and let MindAR handle the camera internally.
    const requestCamera = () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Browser doesn't support getUserMedia — skip pre-check, let MindAR try
        return Promise.resolve();
      }
      return navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
          stream.getTracks().forEach((t) => t.stop());
        })
        .catch((err) => {
          if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
            throw err; // Only block on explicit denial
          }
          // For NotFoundError, OverconstrainedError, etc. — skip and let MindAR try
          return;
        });
    };

    requestCamera()
      .then(() => {
        if (cancelled) return;
        return loadScript(AFRAME_SCRIPT_ID, AFRAME_SCRIPT_SRC);
      })
      .then(() => {
        if (cancelled) return;
        registerDampedAnchor();
        return loadScript(MINDAR_SCRIPT_ID, MINDAR_SCRIPT_SRC);
      })
      .then(() => {
        if (cancelled) return;
        setRuntimeReady(true);
        setStatus('Camera is ready. Keep the stamp flat and inside the frame.');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
          setStatus(
            inAppBrowser
              ? `The ${inAppBrowser} in-app browser blocks the camera. Tap the menu (⋮ or …) and choose "Open in browser", then try again in Chrome or Safari.`
              : 'Camera access was denied. Please allow camera in your browser settings and refresh.'
          );
        } else {
          setRuntimeReady(false);
          setStatus('The scanner could not load. Refresh on your phone and try again.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canRunCameraScanner, scannerRequested, inAppBrowser]);

  useEffect(() => {
    if (!runtimeReady || !scannerRequested) return;

    const targetEntity = document.getElementById('purewells-ar-target');
    const targetEntityPin = document.getElementById('purewells-ar-target-pin');
    const video = document.getElementById('purewells-ar-video') as HTMLVideoElement | null;
    if (!video || (!targetEntity && !targetEntityPin)) return;

    const handleTargetFound = () => {
      const shouldStartMuted = content.app.videoPlayback === 'autoplay-on-detect' && !videoSoundEnabledRef.current;

      eventLogRef.current = [...eventLogRef.current.slice(-4), `found@${new Date().toISOString().slice(14, 19)}`];
      setTargetDetected(true);
      setStatus(shouldStartMuted ? 'Target detected. Video is playing. Tap Enable sound for audio.' : 'Target detected. Video is playing with sound.');
      // Only reset to start if video hasn't begun playing yet
      if (video.ended || (video.paused && video.currentTime === 0)) {
        video.currentTime = 0;
      }
      video.volume = 1;
      video.muted = shouldStartMuted;
      const playback = video.play();
      if (playback) {
        playback.catch((err: unknown) => {
          const e = err as { name?: string; message?: string } | null;
          playErrorRef.current = `${e?.name ?? 'Error'}: ${e?.message ?? String(err)}`;
          setStatus('Target detected. Tap Enable sound once to allow playback on this phone.');
        });
      }
    };

    const handleTargetLost = () => {
      setTargetDetected(false);
      setStatus('Video continues playing. Point camera at stamp or pin to re-anchor.');
      // Don't pause — let the video keep playing even when target is lost
    };

    targetEntity?.addEventListener('targetFound', handleTargetFound);
    targetEntity?.addEventListener('targetLost', handleTargetLost);
    targetEntityPin?.addEventListener('targetFound', handleTargetFound);
    targetEntityPin?.addEventListener('targetLost', handleTargetLost);

    return () => {
      targetEntity?.removeEventListener('targetFound', handleTargetFound);
      targetEntity?.removeEventListener('targetLost', handleTargetLost);
      targetEntityPin?.removeEventListener('targetFound', handleTargetFound);
      targetEntityPin?.removeEventListener('targetLost', handleTargetLost);
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
        height: '100vh',
        overflow: 'hidden',
        background: 'transparent',
        zIndex: '10',
      });
      /* Progressive enhancement: apply 100dvh for modern browsers that support it */
      scene.style.setProperty('height', '100dvh');

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

  useEffect(() => {
    if (!debugMode) return;
    const tick = () => {
      const v = document.getElementById('purewells-ar-video') as HTMLVideoElement | null;
      const scene = document.getElementById('purewells-ar-scene') as (HTMLElement & { hasLoaded?: boolean }) | null;
      const camVideos = document.querySelectorAll('#purewells-scanner-stage video').length;
      const aframe = (window as unknown as { AFRAME?: AframeGlobal }).AFRAME;
      const lines: string[] = [];
      lines.push(`UA ${navigator.userAgent.slice(0, 68)}`);
      lines.push(`secure=${String(window.isSecureContext)} aframe=${aframe ? 'yes' : 'NO'} damped=${aframe?.components?.['damped-anchor'] ? 'yes' : 'NO'}`);
      lines.push(`sceneLoaded=${String(scene?.hasLoaded)} videoEls=${camVideos}`);
      if (!v) {
        lines.push('AR VIDEO ELEMENT: MISSING');
      } else {
        lines.push(`ready=${v.readyState}/4 net=${v.networkState} paused=${String(v.paused)} muted=${String(v.muted)}`);
        lines.push(`t=${v.currentTime.toFixed(1)}s dur=${isNaN(v.duration) ? '?' : v.duration.toFixed(1)}s buf=${v.buffered.length ? v.buffered.end(v.buffered.length - 1).toFixed(1) : 0}s`);
        lines.push(`size=${v.videoWidth}x${v.videoHeight} err=${v.error ? v.error.code : 'none'}`);
        lines.push(`playErr=${playErrorRef.current}`);
      }
      lines.push(`events: ${eventLogRef.current.join(' ') || '(none yet)'}`);
      setDiagnostics(lines);
    };
    tick();
    const id = window.setInterval(tick, 700);
    return () => window.clearInterval(id);
  }, [debugMode, runtimeReady, scannerRequested]);

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
    <main className="fixed inset-0 h-screen w-screen overflow-hidden bg-black text-white" style={{ height: '100dvh' }}>
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
            <a-assets timeout="10000">
              <video id="purewells-ar-video" src={content.app.videoUrl} poster={posterUrl} preload="auto" playsInline loop webkit-playsinline="" crossOrigin="anonymous" muted={content.app.videoPlayback === 'autoplay-on-detect'} />
            </a-assets>
            <a-camera position="0 0 0" look-controls="enabled: false" />
            <a-entity id="purewells-ar-target" mindar-image-target="targetIndex: 0" />
            <a-entity id="purewells-ar-target-pin" mindar-image-target="targetIndex: 1" />
            <a-entity damped-anchor="target: purewells-ar-target">
              <a-video src="#purewells-ar-video" position="0 0 0.01" width={AR_VIDEO_OVERLAY_WIDTH} height={AR_VIDEO_OVERLAY_HEIGHT} rotation="0 0 0" material="shader: flat" />
            </a-entity>
            <a-entity damped-anchor="target: purewells-ar-target-pin; position: 0.07; rotation: 0.03; scale: 0.05">
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
            webkit-playsinline=""
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

              {inAppBrowser && (
                <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-left text-xs leading-5 text-amber-200">
                  You opened this inside {inAppBrowser}. Its built-in browser blocks the camera. Tap the menu (&#8942; or &#8230;) and choose
                  &quot;Open in browser&quot; to continue in Chrome or Safari.
                </div>
              )}
              <button type="button" onClick={handleStartScanner} className="mt-6 w-full rounded-full bg-cyan px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-ink shadow-[0_0_28px_rgba(93,231,255,0.45)] transition hover:bg-white">
                Start camera
              </button>
            </div>
          </div>
        )}

        {debugMode && (
          <div className="pointer-events-none absolute left-2 right-2 top-24 z-50 rounded-lg bg-black/85 p-3 font-mono text-[10px] leading-[1.35] text-lime-300">
            {diagnostics.map((line, i) => (
              <div key={i} className="break-all">{line}</div>
            ))}
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

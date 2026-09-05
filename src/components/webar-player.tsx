'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CmsContent } from '@/lib/cms-schema';

const AFRAME_SCRIPT_ID = 'aframe-runtime-script';
const MINDAR_SCRIPT_ID = 'mindar-image-aframe-runtime-script';
const AFRAME_SCRIPT_SRC = 'https://aframe.io/releases/1.4.2/aframe.min.js';
const MINDAR_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js';
const JSQR_SCRIPT_ID = 'jsqr-runtime-script';
const JSQR_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';

// The entry QR code is printed with the OSAKA stamp artwork inside it, so the image tracker sees
// a stamp when the camera is pointed at the QR - it is the same artwork - and starts the video
// before the user has aimed at anything. No feature-based rule can separate the two, and a decoy
// target compiled from the QR was measured matching the *real* stamp as well, which would suppress
// genuine scans. So the discriminator is the one signal the stamp does not carry: the QR's own
// finder patterns. While a QR is decodable in frame the overlay is held back, and the suppression
// decays shortly after the code leaves the shot so aiming at the stamp starts playing at once.
const SCRIPT_TIMEOUT_MS = 15000;
const QR_SUPPRESS_MS = 1200;
const QR_SAMPLE_INTERVAL_MS = 300;
const QR_SAMPLE_WIDTH = 360;
const qrSuppression = { until: 0 };
const isQrSuppressed = () => Date.now() < qrSuppression.until;
// Measured in target widths: MindAR normalises every target to one unit across, so these numbers
// are how many stamp-widths (or badge-widths) of video sit over the object. The pin badge is only
// about 40mm, so at the old 2.05 the video came out physically small on screen - you had to get
// close before it read as anything. 2.8 keeps it anchored to the object while giving it enough
// presence to watch at arm's length. The video is 1920x1080, so the height holds 16:9.
const AR_VIDEO_OVERLAY_WIDTH = 2.8;
const AR_VIDEO_OVERLAY_HEIGHT = 1.575;
// Grace period between losing every anchor and pausing the video.
const TARGET_LOST_PAUSE_MS = 700;

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
type Vec3Like = {
  copy: (v: Vec3Like) => void;
  lerp: (v: Vec3Like, alpha: number) => void;
  distanceTo: (v: Vec3Like) => number;
};
type QuatLike = {
  copy: (q: QuatLike) => void;
  slerp: (q: QuatLike, alpha: number) => void;
  angleTo: (q: QuatLike) => number;
};
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
  data: {
    targets: string;
    minPosition: number; maxPosition: number;
    minRotation: number; maxRotation: number;
    positionErrorRef: number; rotationErrorRef: number;
  };
  el: HTMLElement & { object3D: Object3DLike };
  pos: Vec3Like; quat: QuatLike; scl: Vec3Like;
  tPos: Vec3Like; tQuat: QuatLike; tScl: Vec3Like;
  settled: boolean;
  ids: string[];
  following: string | null;
};

// MindAR writes the tracked pose straight into el.object3D.matrix (matrixAutoUpdate is off), so
// the anchor snaps to whatever the tracker reports each frame. Its own one-euro filter is near
// its useful limit; pushing it further makes the pose lag until the tracker drops and snaps back.
// So the anchors stay raw and the video renders on a sibling entity that eases toward the
// anchor's decomposed transform.
//
// The ease is adaptive, because most people scan while HOLDING the pin badge: the target really
// moves, and a heavy fixed damper would leave the video floating behind it. The signal we adapt
// on is the *error* between where the overlay currently sits and where the tracker says the
// target is - not the pose's frame-to-frame speed. Speed is useless here: random tracker jitter
// has high instantaneous speed while going nowhere, so it would switch damping off exactly when
// it is needed. Error behaves correctly instead, because jitter cancels out around a mean and
// stays inside a small band, while genuine movement accumulates and pulls the error open.
//
// The blend is squared so that small errors - anything within the noise band - stay near the
// heavily damped floor, and the response only opens up once the target has genuinely moved.
// Rotation keeps the heavier hand: angular jitter is what the eye catches on a plane wider than
// the target itself. Detection never sees this stage, so damping cannot cause a lost target.
//
// One damper follows several anchors, because the stamp and the pin badge are the same artwork
// and cross-match: whichever of the two MindAR happens to lock, the overlay is identical, and
// MindAR normalises every target to one unit wide so the plane sizes itself the same either way.
// Following the live anchor therefore makes a mis-attributed lock harmless instead of stranding
// the video on an anchor that is not the object the camera is pointed at. It also stops the two
// anchors drawing the same video twice now that maxTrack is 2. Ties keep the anchor already being
// followed, so a target that both anchors claim does not flip the overlay between them.
let dampedAnchorRegistered = false;

function registerDampedAnchor() {
  const aframe = (window as unknown as { AFRAME?: AframeGlobal }).AFRAME;
  if (!aframe || dampedAnchorRegistered || aframe.components['damped-anchor']) return;
  dampedAnchorRegistered = true;
  const THREE = aframe.THREE;

  const blend = (min: number, max: number, error: number, ref: number) => {
    const t = Math.min(1, Math.max(0, error / ref));
    return min + (max - min) * t * t;
  };

  aframe.registerComponent('damped-anchor', {
    schema: {
      // Comma-separated anchor ids, in preference order.
      targets: { type: 'string' },
      minPosition: { type: 'number', default: 0.10 },
      maxPosition: { type: 'number', default: 0.60 },
      minRotation: { type: 'number', default: 0.05 },
      maxRotation: { type: 'number', default: 0.50 },
      // Errors are in target widths (the target image is 1 unit) and radians.
      positionErrorRef: { type: 'number', default: 0.08 },
      rotationErrorRef: { type: 'number', default: 0.10 }
    },
    init(this: DampedAnchor) {
      this.pos = new THREE.Vector3();
      this.quat = new THREE.Quaternion();
      this.scl = new THREE.Vector3(1, 1, 1);
      this.tPos = new THREE.Vector3();
      this.tQuat = new THREE.Quaternion();
      this.tScl = new THREE.Vector3(1, 1, 1);
      this.settled = false;
      this.following = null;
      this.ids = this.data.targets.split(',').map((id) => id.trim()).filter(Boolean);
      this.el.object3D.matrixAutoUpdate = false;
    },
    tick(this: DampedAnchor) {
      const visible = (id: string) => {
        const object3D = (document.getElementById(id) as AnchorElement | null)?.object3D;
        return object3D && object3D.visible ? object3D : null;
      };
      // Hysteresis: hold the anchor already being followed while it stays visible.
      const heldId = this.following && visible(this.following) ? this.following : null;
      const activeId = heldId ?? this.ids.find((id) => visible(id)) ?? null;
      // A QR in shot means the camera is aimed at the entry code, not at the stamp or the badge.
      const src = activeId && !isQrSuppressed() ? visible(activeId) : null;
      const dst = this.el.object3D;

      dst.visible = src !== null;
      if (!src) {
        // Re-seed on the next acquisition so the overlay never eases in from a stale pose.
        this.settled = false;
        this.following = null;
        return;
      }
      if (activeId !== this.following) {
        // Handing over between anchors is an acquisition, not motion to ease through.
        this.following = activeId;
        this.settled = false;
      }

      src.matrix.decompose(this.tPos, this.tQuat, this.tScl);

      if (!this.settled) {
        this.pos.copy(this.tPos);
        this.quat.copy(this.tQuat);
        this.scl.copy(this.tScl);
        this.settled = true;
      } else {
        const aPos = blend(this.data.minPosition, this.data.maxPosition, this.pos.distanceTo(this.tPos), this.data.positionErrorRef);
        const aRot = blend(this.data.minRotation, this.data.maxRotation, this.quat.angleTo(this.tQuat), this.data.rotationErrorRef);
        this.pos.lerp(this.tPos, aPos);
        this.quat.slerp(this.tQuat, aRot);
        this.scl.lerp(this.tScl, aPos);
      }

      dst.matrix.compose(this.pos, this.quat, this.scl);
    }
  });
}

function hasValue(value: string) {
  return value.trim().length > 0;
}

// A CDN that accepts the connection and then stalls never fires load or error, so without a
// deadline the whole camera start-up waits on it forever. On event wifi that is the difference
// between "the scanner is slow" and "the scanner never opens".
function loadScript(id: string, src: string, timeoutMs = SCRIPT_TIMEOUT_MS) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === 'true') {
      resolve();
      return;
    }

    let timer = 0;
    const settle = (fn: () => void) => {
      if (timer) window.clearTimeout(timer);
      fn();
    };
    timer = window.setTimeout(() => reject(new Error(`Timed out loading ${src}`)), timeoutMs);

    if (existing) {
      existing.addEventListener('load', () => settle(resolve), { once: true });
      existing.addEventListener('error', () => settle(() => reject(new Error(`Failed to load ${src}`))), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.addEventListener('load', () => settle(() => {
      script.dataset.loaded = 'true';
      resolve();
    }));
    script.addEventListener('error', () => settle(() => reject(new Error(`Failed to load ${src}`))));
    document.head.appendChild(script);
  });
}

export function WebArPlayer({ content, entryMode = 'scanner' }: { content: CmsContent; entryMode?: WebArEntryMode }) {
  const targetImageUrl = hasValue(content.app.targetImageUrl) ? content.app.targetImageUrl : '/sample-ar-target.svg';
  const posterUrl = hasValue(content.app.videoPosterUrl) ? content.app.videoPosterUrl : '/sample-video-poster.svg';
  const hasVideo = hasValue(content.app.videoUrl);
  const hasTrackingData = content.app.trackingMode === 'manual-preview' || hasValue(content.app.trackingDataUrl);
  // The /player route exists to play the video and nothing else. Everything reached by scanning
  // the QR code goes to /scan, which lands on the camera: the product flow is QR -> Start camera
  // -> point at the stamp or the pin badge -> the video plays on the object. Opening the video
  // outright there skipped the entire AR experience, so /scan now only shows the plain player
  // when someone deliberately asks for it with "Watch the video instead".
  const opensInVideoMode = entryMode === 'video' && hasVideo;
  const [videoFallbackRequested, setVideoFallbackRequested] = useState(false);
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
  const qrSeenRef = useRef<number>(0);
  const canRunCameraScanner = content.app.trackingMode === 'image-target' && hasTrackingData && hasVideo;
  const targetMindSrc = content.app.trackingDataUrl;
  const sceneConfig = useMemo(
    () =>
      // One-euro filter: cutoff = filterMinCF + filterBeta * |velocity|.
      // MindAR defaults (0.001 / 1000) let hand tremor through almost unfiltered, which is the
      // shaky overlay. With beta near zero the cutoff stays at filterMinCF regardless of motion,
      // so the pose is heavily damped and the overlay sits still, and a high missTolerance keeps
      // it from flickering out during brief occlusion.
      //
      // maxTrack must be 2, not MindAR's default 1. The stamp and the pin badge carry the same
      // artwork, so the stamp's descriptors match a photo of the pin badge in most realistic
      // framings. MindAR's worker walks the target indexes in ascending order and stops at the
      // first hit, so scanning the pin very often locks target 0. At maxTrack 1 that lock also
      // suspends detection entirely, and the pin's own target never gets a look-in until the
      // wrong lock decays. Allowing both to track removes that dead end.
      //
      // warmupTolerance stays at 1 (MindAR's default is 5). It gates targetFound on N+1
      // consecutive *tracked* frames, and the pin badge is domed, gold and specular, so its
      // tracking drops in and out where the flat printed stamp's does not - a high warmup is a
      // barrier for the pin alone. The reason it was raised, an overlay popping in on one noisy
      // frame, is now handled by damped-anchor, which eases the overlay in from each acquisition.
      `imageTargetSrc: ${targetMindSrc}; autoStart: true; uiScanning: yes; uiLoading: yes; uiError: yes; maxTrack: 2; filterMinCF: 0.0001; filterBeta: 1; warmupTolerance: 1; missTolerance: 50`,
    [targetMindSrc]
  );
  const showDirectVideo = (opensInVideoMode || videoFallbackRequested) && hasVideo && !runtimeReady;

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
        setStatus('Camera is ready. Point it at the stamp or the pin badge.');
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

    // Both anchors can be live at once now that maxTrack is 2 and the two targets cross-match,
    // so detection is a count, not a flag: one anchor dropping while the other still holds the
    // object must not report the target as lost.
    const held = new Set<string>();

    // The video is anchored to a physical object, so it stops when that object leaves the frame.
    // The pause is deferred by a short grace period rather than fired on the event, because
    // targetLost also fires on a momentary drop mid-scan - a hand wobble, a glare across the
    // badge - and pausing on those would chop the soundtrack up. MindAR's own missTolerance
    // already absorbs about 1.7s of that before it emits the event at all, so anything still
    // missing after the grace window has genuinely been taken out of shot.
    let pauseTimer = 0;
    const cancelPause = () => {
      if (pauseTimer) {
        window.clearTimeout(pauseTimer);
        pauseTimer = 0;
      }
    };

    const handleTargetFound = (event: Event) => {
      const shouldStartMuted = content.app.videoPlayback === 'autoplay-on-detect' && !videoSoundEnabledRef.current;

      held.add((event.currentTarget as HTMLElement | null)?.id ?? 'unknown');

      // Pointing at the entry QR matches the stamp, because the stamp artwork is printed inside
      // the code. Only the physical stamp and pin badge play the video.
      if (isQrSuppressed()) {
        eventLogRef.current = [...eventLogRef.current.slice(-4), `qr-blocked@${new Date().toISOString().slice(14, 19)}`];
        setTargetDetected(false);
        setStatus('That is the QR code. Point the camera at the OSAKA stamp or the pin badge.');
        if (!video.paused) video.pause();
        return;
      }

      cancelPause();
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

    const handleTargetLost = (event: Event) => {
      held.delete((event.currentTarget as HTMLElement | null)?.id ?? 'unknown');
      if (held.size > 0) return;
      setTargetDetected(false);
      setStatus('Paused. Point the camera back at the stamp or pin badge to continue.');
      cancelPause();
      pauseTimer = window.setTimeout(() => {
        pauseTimer = 0;
        // Re-check: an anchor may have come back inside the grace window.
        if (held.size === 0 && !video.paused) video.pause();
      }, TARGET_LOST_PAUSE_MS);
    };

    targetEntity?.addEventListener('targetFound', handleTargetFound);
    targetEntity?.addEventListener('targetLost', handleTargetLost);
    targetEntityPin?.addEventListener('targetFound', handleTargetFound);
    targetEntityPin?.addEventListener('targetLost', handleTargetLost);

    return () => {
      cancelPause();
      targetEntity?.removeEventListener('targetFound', handleTargetFound);
      targetEntity?.removeEventListener('targetLost', handleTargetLost);
      targetEntityPin?.removeEventListener('targetFound', handleTargetFound);
      targetEntityPin?.removeEventListener('targetLost', handleTargetLost);
    };
  }, [content.app.videoPlayback, runtimeReady, scannerRequested]);

  // Watches the camera feed for the entry QR code and holds the overlay back while one is in
  // shot. Sampling a downscaled frame a few times a second is enough - the code only has to be
  // seen, not tracked - and keeps the cost off the tracking loop.
  useEffect(() => {
    if (!runtimeReady || !scannerRequested) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const cameraVideo = () => {
      const root = document.getElementById('purewells-scanner-stage');
      if (!root) return null;
      return Array.from(root.querySelectorAll('video')).find(
        (v) => !['purewells-ar-video', 'purewells-direct-video'].includes(v.id) && v.videoWidth > 0
      ) ?? null;
    };

    const sample = () => {
      // Resolved per tick: the reader is fetched in parallel with the camera and may land after
      // the scanner is already running.
      const jsQR = (window as unknown as { jsQR?: (d: Uint8ClampedArray, w: number, h: number, o?: unknown) => unknown }).jsQR;
      if (typeof jsQR !== 'function') return;
      const video = cameraVideo();
      if (!video) return;
      const w = QR_SAMPLE_WIDTH;
      const h = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * w));
      canvas.width = w;
      canvas.height = h;
      try {
        ctx.drawImage(video, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        if (jsQR(data, w, h, { inversionAttempts: 'dontInvert' })) {
          qrSuppression.until = Date.now() + QR_SUPPRESS_MS;
          qrSeenRef.current = Date.now();
          // Also covers the QR drifting into shot after the stamp has already been acquired.
          const arVideo = document.getElementById('purewells-ar-video') as HTMLVideoElement | null;
          if (arVideo && !arVideo.paused) {
            arVideo.pause();
            setTargetDetected(false);
            setStatus('That is the QR code. Point the camera at the OSAKA stamp or the pin badge.');
          }
        }
      } catch {
        // A frame that is not ready yet, or a tainted canvas; skip it.
      }
    };

    const id = window.setInterval(sample, QR_SAMPLE_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
      qrSuppression.until = 0;
    };
  }, [runtimeReady, scannerRequested]);

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
      // Which anchor is actually live tells stamp-vs-pin apart on a real device: the two targets
      // carry the same artwork, so a pin scan can light the stamp anchor and vice versa.
      const anchorState = ['purewells-ar-target', 'purewells-ar-target-pin']
        .map((id) => {
          const el = document.getElementById(id) as (HTMLElement & { object3D?: { visible: boolean } }) | null;
          return `${id.endsWith('-pin') ? 'pin' : 'stamp'}=${el?.object3D ? (el.object3D.visible ? 'ON' : 'off') : 'n/a'}`;
        })
        .join(' ');
      lines.push(`anchors: ${anchorState}`);
      const sinceQr = qrSeenRef.current ? `${((Date.now() - qrSeenRef.current) / 1000).toFixed(1)}s ago` : 'never';
      lines.push(`qr: reader=${typeof (window as unknown as { jsQR?: unknown }).jsQR === 'function' ? 'yes' : 'NO'} seen=${sinceQr} blocking=${isQrSuppressed() ? 'YES' : 'no'}`);
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
    // Fetched alongside the camera rather than before it. The QR guard is a refinement; the
    // camera opening is the whole product, and it must never queue behind a third-party CDN.
    loadScript(JSQR_SCRIPT_ID, JSQR_SCRIPT_SRC).catch(() => undefined);
    videoSoundEnabledRef.current = false;
    setVideoSoundEnabled(false);
    setVideoFallbackRequested(false);
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
            <a-entity damped-anchor="targets: purewells-ar-target-pin, purewells-ar-target; minPosition: 0.08; minRotation: 0.035; maxPosition: 0.65; maxRotation: 0.55">
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
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan">Scan the stamp or pin badge</p>
              <h1 className="mt-4 text-3xl font-black leading-tight tracking-[-0.04em] text-white">Open camera and scan</h1>
              <p className="mt-4 text-sm leading-6 text-white/70">Tap Start camera, allow camera access, then point your phone at the stamp or the pin badge. The video will play on it.</p>

              {inAppBrowser && (
                <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-left text-xs leading-5 text-amber-200">
                  You opened this inside {inAppBrowser}. Its built-in browser blocks the camera. Tap the menu (&#8942; or &#8230;) and choose
                  &quot;Open in browser&quot; to continue in Chrome or Safari.
                </div>
              )}
              <button type="button" onClick={handleStartScanner} className="mt-6 w-full rounded-full bg-cyan px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-ink shadow-[0_0_28px_rgba(93,231,255,0.45)] transition hover:bg-white">
                Start camera
              </button>
              {/* Kept for phones where the camera or AR will not run at all, and for anyone who
                  arrived without the physical stamp or badge in hand. */}
              {hasVideo && (
                <button type="button" onClick={(event) => { event.stopPropagation(); setVideoFallbackRequested(true); }} className="mt-3 w-full rounded-full border border-white/20 px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white/70 transition hover:bg-white/10 hover:text-white">
                  Watch the video instead
                </button>
              )}
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
            {/* The printed QR code points at ?mode=video, which lands on the plain video player.
                Without this the scanner is unreachable from the QR - the only entry point most
                people ever use - so neither the stamp nor the pin badge can be scanned at all. */}
            {showDirectVideo && canRunCameraScanner && (
              <button type="button" onClick={(event) => { event.stopPropagation(); handleStartScanner(); }} className="pointer-events-auto mt-3 w-full rounded-full border border-cyan/40 bg-cyan/15 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-cyan hover:bg-cyan hover:text-ink">
                Open AR scanner / スキャン
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

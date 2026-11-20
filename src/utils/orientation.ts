// Automatic landscape orientation & viewport transition helper for mobile browsers and installed PWAs.
// Checks screen/viewport geometry explicitly and advises App.tsx when the browser cannot lock natively.

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface LockableScreenOrientation {
  lock?: (orientation: 'landscape' | 'landscape-primary' | 'landscape-secondary') => Promise<void>;
}

export interface StartupOrientationAdvice {
  isMobile: boolean;
  isScreenPortrait: boolean;
  isViewportPortrait: boolean;
  orientationApiLocked: boolean;
  shouldForceLandscapeLayout: boolean;
}

let pendingLock = false;

export function isMobileOrTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const hasTouchPoints = (navigator.maxTouchPoints ?? 0) > 0 || 'ontouchstart' in window;
  const mobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || ''
  );
  return coarsePointer || hasTouchPoints || mobileUa;
}

export function isEmbeddedFrame(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isCurrentlyLandscape(): boolean {
  if (typeof window === 'undefined') return true;
  return window.innerWidth >= window.innerHeight;
}

export function isScreenHardwarePortrait(): boolean {
  if (typeof window === 'undefined' || typeof window.screen === 'undefined') return false;
  return window.screen.width < window.screen.height;
}

export function shouldForceRotatedLandscape(): boolean {
  if (typeof window === 'undefined') return false;
  if (!isMobileOrTouchDevice()) return false;
  // Force horizontal layout whenever the active viewport is still portrait
  return window.innerWidth < window.innerHeight;
}

export async function lockLandscapeOrientation(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof screen === 'undefined') return false;

  try {
    const orientation = screen.orientation as unknown as LockableScreenOrientation | undefined;
    if (orientation && typeof orientation.lock === 'function') {
      // 'landscape' permits both primary and secondary landscape orientations
      await orientation.lock('landscape');
      return true;
    }
  } catch {
    // Browser denied or requires fullscreen/installed PWA/user gesture; ignore silently
  }

  return false;
}

export async function enterLandscapeMode(options?: { requestFullscreen?: boolean }): Promise<boolean> {
  if (!isMobileOrTouchDevice() || pendingLock) return false;
  pendingLock = true;

  try {
    const shouldTryFullscreen = Boolean(options?.requestFullscreen) && !isEmbeddedFrame();

    if (shouldTryFullscreen) {
      try {
        const docEl = document.documentElement as FullscreenElement | null;
        const isFullscreen = Boolean(
          document.fullscreenElement ||
            (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement
        );

        if (docEl && !isFullscreen) {
          if (typeof docEl.requestFullscreen === 'function') {
            await docEl
              .requestFullscreen({ navigationUI: 'hide' })
              .catch(() => docEl.requestFullscreen());
          } else if (typeof docEl.webkitRequestFullscreen === 'function') {
            await docEl.webkitRequestFullscreen();
          }
        }
      } catch {
        // Fullscreen may be blocked or unsupported; continue and try orientation lock anyway
      }
    }

    return await lockLandscapeOrientation();
  } finally {
    pendingLock = false;
  }
}

export async function tryStartupLandscapeLock(): Promise<StartupOrientationAdvice> {
  const isMobile = isMobileOrTouchDevice();
  const isScreenPortrait = isScreenHardwarePortrait();
  const isViewportPortrait = typeof window !== 'undefined' ? window.innerWidth < window.innerHeight : false;

  if (!isMobile) {
    return {
      isMobile: false,
      isScreenPortrait,
      isViewportPortrait,
      orientationApiLocked: false,
      shouldForceLandscapeLayout: false,
    };
  }

  let orientationApiLocked = false;
  if (isScreenPortrait || isViewportPortrait) {
    orientationApiLocked = await lockLandscapeOrientation();
  }

  const postLockScreenPortrait = isScreenHardwarePortrait();
  const postLockViewportPortrait =
    typeof window !== 'undefined' ? window.innerWidth < window.innerHeight : false;

  return {
    isMobile: true,
    isScreenPortrait: postLockScreenPortrait,
    isViewportPortrait: postLockViewportPortrait,
    orientationApiLocked,
    // Advise App.tsx to force a horizontal landscape viewport whenever device/viewport stays portrait
    shouldForceLandscapeLayout:
      !orientationApiLocked && (postLockScreenPortrait || postLockViewportPortrait),
  };
}

export function tryGestureLandscapeLock(): void {
  if (!isMobileOrTouchDevice() || isEmbeddedFrame()) return;
  const isFullscreen = Boolean(
    document.fullscreenElement ||
      (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement
  );
  if (isScreenHardwarePortrait() || !isCurrentlyLandscape() || !isFullscreen) {
    void enterLandscapeMode({ requestFullscreen: true });
  } else {
    void lockLandscapeOrientation();
  }
}

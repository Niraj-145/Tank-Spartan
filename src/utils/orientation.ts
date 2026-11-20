// Automatic landscape orientation & safe fullscreen helper for mobile browsers and installed PWAs.
// Fails silently in unsupported browsers or embedded preview frames without showing blocking popups.

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface LockableScreenOrientation {
  lock?: (orientation: 'landscape' | 'landscape-primary' | 'landscape-secondary') => Promise<void>;
}

let autoLockAttemptedOnGesture = false;

export function isMobileOrTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const hasTouchPoints = (navigator.maxTouchPoints ?? 0) > 0 || 'ontouchstart' in window;
  const mobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || ''
  );
  return coarsePointer || hasTouchPoints || mobileUa;
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

export function isEmbeddedFrame(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
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

export async function enterLandscapeMode(options?: { requestFullscreen?: boolean }): Promise<void> {
  if (!isMobileOrTouchDevice()) return;

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
          await docEl.requestFullscreen({ navigationUI: 'hide' }).catch(() => docEl.requestFullscreen());
        } else if (typeof docEl.webkitRequestFullscreen === 'function') {
          await docEl.webkitRequestFullscreen();
        }
      }
    } catch {
      // Fullscreen may be blocked or unsupported; continue and try orientation lock anyway
    }
  }

  await lockLandscapeOrientation();
}

export async function tryStartupLandscapeLock(): Promise<void> {
  if (!isMobileOrTouchDevice()) return;
  await lockLandscapeOrientation();
}

export function tryFirstGestureLandscapeLock(): void {
  if (autoLockAttemptedOnGesture || !isMobileOrTouchDevice()) return;
  autoLockAttemptedOnGesture = true;
  void enterLandscapeMode({ requestFullscreen: isAndroidDevice() });
}

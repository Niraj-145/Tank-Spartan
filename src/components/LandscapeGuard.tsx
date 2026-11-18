import React, { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';

export async function requestAndroidLandscapeFullscreen(): Promise<void> {
  try {
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    if (!document.fullscreenElement) {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      }
    }
  } catch {
    // Fullscreen may be declined or unsupported inside embedded frames
  }

  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: 'landscape' | 'landscape-primary') => Promise<void>;
    };
    if (orientation?.lock) {
      await orientation.lock('landscape');
    }
  } catch {
    // Orientation lock is only allowed in fullscreen or installed PWA on supported devices
  }
}

export const LandscapeGuard: React.FC = () => {
  const [showRotatePrompt, setShowRotatePrompt] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      const isCoarsePointer =
        window.matchMedia('(pointer: coarse)').matches ||
        (navigator.maxTouchPoints ?? 0) > 0;
      const isNarrowMobile = window.innerWidth < 768;
      setShowRotatePrompt(isPortrait && (isCoarsePointer || isNarrowMobile));
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (!showRotatePrompt) return null;

  return (
    <div className="fixed inset-0 h-[100dvh] z-50 flex flex-col items-center justify-center p-6 text-center bg-[#0d1117]/98 overflow-hidden">
      <div className="w-16 h-16 rounded-2xl bg-[#151c26] border border-amber-500/50 flex items-center justify-center mb-4 shrink-0">
        <RotateCw className="w-8 h-8 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
      </div>
      <h2 className="font-display text-3xl font-bold text-white uppercase tracking-tight leading-none">
        Rotate to Landscape
      </h2>
      <p className="mt-2.5 text-sm text-slate-300 max-w-xs leading-snug">
        Turn your Android device sideways to play Tank Spartan in landscape mode with dual-stick controls.
      </p>
      <button
        type="button"
        onClick={requestAndroidLandscapeFullscreen}
        className="mt-6 px-5 py-2.5 min-h-[44px] rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold transition-colors cursor-pointer"
      >
        Lock Landscape
      </button>
    </div>
  );
};

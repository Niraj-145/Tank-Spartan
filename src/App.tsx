/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { LevelsScreen } from './components/LevelsScreen';
import { OverlayModals } from './components/OverlayModals';
import { StoreModal } from './components/StoreModal';
import { TitleScreen } from './components/TitleScreen';
import { TouchController } from './components/TouchController';
import { TankGameEngine } from './game/engine';
import { sound } from './game/sound';
import { HudSnapshot, WeaponId } from './game/types';
import {
  enterLandscapeMode,
  isMobileOrTouchDevice,
  shouldForceRotatedLandscape,
  tryGestureLandscapeLock,
  tryStartupLandscapeLock,
} from './utils/orientation';

const IntroAnimation = lazy(() =>
  import('./components/IntroAnimation').then((m) => ({ default: m.IntroAnimation }))
);

export default function App() {
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<TankGameEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [introState, setIntroState] = useState<'active' | 'exiting' | 'done'>('active');
  const [muted, setMuted] = useState(false);
  const [showLevelsPage, setShowLevelsPage] = useState(false);
  const [storeMinimized, setStoreMinimized] = useState(false);
  const [touchControlsEnabled, setTouchControlsEnabled] = useState<boolean>(() => isMobileOrTouchDevice());
  const [rotatedLandscape, setRotatedLandscape] = useState<boolean>(() => shouldForceRotatedLandscape());
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  }));
  const [sceneFade, setSceneFade] = useState<{ id: number; blocking: boolean }>({
    id: 0,
    blocking: false,
  });
  const fadeSwapTimerRef = useRef<number | null>(null);
  const fadeDoneTimerRef = useRef<number | null>(null);
  const prevPhaseRef = useRef<string>('TITLE');

  useEffect(() => {
    let mounted = true;
    const engine = new TankGameEngine((snapshot) => {
      if (snapshot.phase === 'INTER_WAVE_STORE' && prevPhaseRef.current !== 'INTER_WAVE_STORE') {
        setStoreMinimized(false);
      }
      prevPhaseRef.current = snapshot.phase;
      setHud(snapshot);
    });
    engineRef.current = engine;
    setHud(engine.getSnapshot());
    engine.attachCanvases(mainCanvasRef.current, radarCanvasRef.current);
    engine.setRotatedLandscape(shouldForceRotatedLandscape());
    engine.startLoop();

    const syncViewportOrientation = () => {
      if (!mounted) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const forceRotate = shouldForceRotatedLandscape();
      setViewportSize({ width: w, height: h });
      setRotatedLandscape(forceRotate);
      engine.setRotatedLandscape(forceRotate);
    };

    syncViewportOrientation();
    window.addEventListener('resize', syncViewportOrientation);
    window.addEventListener('orientationchange', syncViewportOrientation);
    window.visualViewport?.addEventListener('resize', syncViewportOrientation);
    screen.orientation?.addEventListener?.('change', syncViewportOrientation);

    // Check screen.width < screen.height, attempt native lock, and follow startup advice
    void tryStartupLandscapeLock().then((advice) => {
      if (!mounted) return;
      const forceRotate = advice.shouldForceLandscapeLayout && window.innerWidth < window.innerHeight;
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
      setRotatedLandscape(forceRotate);
      engine.setRotatedLandscape(forceRotate);
    });

    return () => {
      mounted = false;
      if (fadeSwapTimerRef.current !== null) window.clearTimeout(fadeSwapTimerRef.current);
      if (fadeDoneTimerRef.current !== null) window.clearTimeout(fadeDoneTimerRef.current);
      window.removeEventListener('resize', syncViewportOrientation);
      window.removeEventListener('orientationchange', syncViewportOrientation);
      window.visualViewport?.removeEventListener('resize', syncViewportOrientation);
      screen.orientation?.removeEventListener?.('change', syncViewportOrientation);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Auto-enable on-screen controller & request landscape mode on valid mobile gestures (click / touchend)
  useEffect(() => {
    const onTouchPointer = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        setTouchControlsEnabled(true);
      }
    };
    const onActivationGesture = () => {
      tryGestureLandscapeLock();
    };
    window.addEventListener('pointerdown', onTouchPointer, { passive: true });
    window.addEventListener('touchend', onActivationGesture, { passive: true });
    window.addEventListener('click', onActivationGesture, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onTouchPointer);
      window.removeEventListener('touchend', onActivationGesture);
      window.removeEventListener('click', onActivationGesture);
    };
  }, []);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.attachCanvases(mainCanvasRef.current, radarCanvasRef.current);
      engineRef.current.setHomePageActive(
        hud?.phase === 'TITLE' && !showLevelsPage && introState === 'done'
      );
    }
  }, [hud?.phase, showLevelsPage, introState]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      sound.setMuted(next);
      return next;
    });
  }, []);

  const handleToggleTouchControls = useCallback(() => {
    setTouchControlsEnabled((prev) => !prev);
  }, []);

  const triggerSceneFade = useCallback((onMidpoint: () => void) => {
    if (fadeSwapTimerRef.current !== null) window.clearTimeout(fadeSwapTimerRef.current);
    if (fadeDoneTimerRef.current !== null) window.clearTimeout(fadeDoneTimerRef.current);

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const swapDelay = reducedMotion ? 80 : 235;
    const endDelay = reducedMotion ? 200 : 580;

    setSceneFade((prev) => ({ id: prev.id + 1, blocking: true }));

    fadeSwapTimerRef.current = window.setTimeout(() => {
      fadeSwapTimerRef.current = null;
      onMidpoint();
      setSceneFade((prev) => ({ ...prev, blocking: false }));
    }, swapDelay);

    fadeDoneTimerRef.current = window.setTimeout(() => {
      fadeDoneTimerRef.current = null;
      setSceneFade((prev) => ({ ...prev, id: 0, blocking: false }));
    }, endDelay);
  }, []);

  const handleOpenLevels = useCallback(() => {
    if (isMobileOrTouchDevice()) {
      void enterLandscapeMode({ requestFullscreen: true });
    }
    setShowLevelsPage(true);
  }, []);

  const handleStartMission = useCallback(
    (level: number) => {
      if (isMobileOrTouchDevice()) {
        void enterLandscapeMode({ requestFullscreen: true });
      }
      triggerSceneFade(() => {
        setShowLevelsPage(false);
        setStoreMinimized(false);
        engineRef.current?.startNewCampaign(level);
      });
    },
    [triggerSceneFade]
  );

  const handleStartTutorial = useCallback(() => {
    if (isMobileOrTouchDevice()) {
      void enterLandscapeMode({ requestFullscreen: true });
    }
    triggerSceneFade(() => {
      setShowLevelsPage(false);
      setStoreMinimized(false);
      engineRef.current?.startTutorial();
    });
  }, [triggerSceneFade]);

  const handleSkipTutorial = useCallback(() => {
    triggerSceneFade(() => {
      setStoreMinimized(false);
      engineRef.current?.skipTutorial();
    });
  }, [triggerSceneFade]);

  const handleSelectWeapon = useCallback((id: WeaponId) => {
    engineRef.current?.selectWeapon(id);
  }, []);

  const handleLaunchNextWave = useCallback(() => {
    if (hud?.isTutorial) {
      triggerSceneFade(() => {
        setStoreMinimized(false);
        engineRef.current?.launchNextWaveEarly();
      });
      return;
    }
    setStoreMinimized(false);
    engineRef.current?.launchNextWaveEarly();
  }, [hud?.isTutorial, triggerSceneFade]);

  const handleProceedNextLevel = useCallback(() => {
    triggerSceneFade(() => {
      setStoreMinimized(false);
      engineRef.current?.proceedToNextLevelFromStoreOrComplete();
    });
  }, [triggerSceneFade]);

  const handlePlayAgain = useCallback(() => {
    const levelToRestart = hud?.level ?? 1;
    triggerSceneFade(() => {
      setStoreMinimized(false);
      engineRef.current?.startNewCampaign(levelToRestart);
    });
  }, [hud?.level, triggerSceneFade]);

  const handleMainMenu = useCallback(() => {
    triggerSceneFade(() => {
      setShowLevelsPage(false);
      setStoreMinimized(false);
      engineRef.current?.returnToTitle();
    });
  }, [triggerSceneFade]);

  const handleVirtualMove = useCallback((x: number, y: number) => {
    engineRef.current?.setVirtualMove(x, y);
  }, []);

  const handleVirtualAim = useCallback((x: number, y: number, firing: boolean) => {
    engineRef.current?.setVirtualAim(x, y, firing);
  }, []);

  const handleVirtualFireButton = useCallback((firing: boolean) => {
    engineRef.current?.setVirtualFireButton(firing);
  }, []);

  const handleVirtualReset = useCallback(() => {
    engineRef.current?.resetVirtualInputs();
  }, []);

  const effectiveHeight = rotatedLandscape ? viewportSize.width : viewportSize.height;
  const isCompactHeight = effectiveHeight < 520;

  return (
    <div
      data-compact={isCompactHeight ? 'true' : 'false'}
      className="@container group/root fixed top-0 left-0 overflow-hidden bg-[#0d1117] touch-none"
      style={
        rotatedLandscape
          ? {
              width: `${viewportSize.height}px`,
              height: `${viewportSize.width}px`,
              transform: 'rotate(90deg) translateY(-100%)',
              transformOrigin: 'top left',
            }
          : {
              width: '100%',
              height: '100%',
            }
      }
    >
      {/* Isolated 60fps Full-Screen Scrolling Game Viewport */}
      <canvas
        ref={mainCanvasRef}
        className="block w-full h-full cursor-crosshair touch-none"
      />

      {hud && hud.phase === 'TITLE' && !showLevelsPage && (
        <TitleScreen
          unlockedMaxLevel={hud.unlockedMaxLevel}
          muted={muted}
          gamepadConnected={hud.gamepadConnected}
          introState={introState}
          onToggleMute={handleToggleMute}
          onPlayHighest={() => handleStartMission(hud.unlockedMaxLevel)}
          onOpenLevels={handleOpenLevels}
          onStartTutorial={handleStartTutorial}
        />
      )}

      {hud && hud.phase === 'TITLE' && showLevelsPage && (
        <LevelsScreen
          unlockedMaxLevel={hud.unlockedMaxLevel}
          onSelectLevel={handleStartMission}
          onBack={() => setShowLevelsPage(false)}
        />
      )}

      {hud && hud.phase !== 'TITLE' && (
        <GameHud
          hud={hud}
          radarCanvasRef={radarCanvasRef}
          muted={muted}
          storeMinimized={storeMinimized}
          touchControlsEnabled={touchControlsEnabled}
          onToggleMute={handleToggleMute}
          onToggleTouchControls={handleToggleTouchControls}
          onPause={() => engineRef.current?.pauseGame()}
          onReopenStore={() => setStoreMinimized(false)}
          onLaunchNextWave={handleLaunchNextWave}
          onSkipTutorial={handleSkipTutorial}
        />
      )}

      {hud && (
        <TouchController
          visible={hud.phase === 'PLAYING' && touchControlsEnabled}
          rotatedLandscape={rotatedLandscape}
          onMove={handleVirtualMove}
          onAim={handleVirtualAim}
          onFireButton={handleVirtualFireButton}
          onReset={handleVirtualReset}
        />
      )}

      {hud && hud.phase === 'INTER_WAVE_STORE' && !storeMinimized && (
        <StoreModal
          hud={hud}
          onSelectWeapon={handleSelectWeapon}
          onBuyWeaponUnlock={(id) => engineRef.current?.buyWeaponUnlock(id)}
          onUpgradeWeaponStat={(id, stat) => engineRef.current?.upgradeWeaponStat(id, stat)}
          onUpgradeChassis={(kind) => engineRef.current?.upgradeChassis(kind)}
          onBuyRepair={() => engineRef.current?.buyRepairKit()}
          onLaunchNextWave={handleLaunchNextWave}
          onProceedNextLevel={handleProceedNextLevel}
          onMinimize={() => setStoreMinimized(true)}
        />
      )}

      {hud && (
        <OverlayModals
          hud={hud}
          onResume={() => engineRef.current?.resumeGame()}
          onOpenStoreAfterLevel={() => engineRef.current?.openStoreFromLevelComplete()}
          onNextLevel={handleProceedNextLevel}
          onPlayAgain={handlePlayAgain}
          onMainMenu={handleMainMenu}
        />
      )}

      {introState !== 'done' && (
        <Suspense fallback={<div className="absolute inset-0 z-40 bg-[#0d1117]" />}>
          <IntroAnimation
            onExitStart={() => setIntroState('exiting')}
            onComplete={() => setIntroState('done')}
          />
        </Suspense>
      )}

      {sceneFade.id > 0 && (
        <div
          key={sceneFade.id}
          aria-hidden="true"
          className={`scene-fade-overlay absolute inset-0 z-50 bg-[#0d1117] ${
            sceneFade.blocking ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        />
      )}
    </div>
  );
}

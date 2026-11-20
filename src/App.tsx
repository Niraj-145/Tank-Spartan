/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
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
  tryFirstGestureLandscapeLock,
  tryStartupLandscapeLock,
} from './utils/orientation';

export default function App() {
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<TankGameEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [muted, setMuted] = useState(false);
  const [showLevelsPage, setShowLevelsPage] = useState(false);
  const [storeMinimized, setStoreMinimized] = useState(false);
  const [touchControlsEnabled, setTouchControlsEnabled] = useState<boolean>(() => isMobileOrTouchDevice());
  const prevPhaseRef = useRef<string>('TITLE');

  useEffect(() => {
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
    engine.startLoop();

    // Attempt automatic landscape orientation immediately on startup (succeeds in standalone PWAs / permissive browsers)
    void tryStartupLandscapeLock();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Auto-enable on-screen controller & attempt landscape orientation on first mobile touch interaction
  useEffect(() => {
    const onTouchInteraction = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        setTouchControlsEnabled(true);
        tryFirstGestureLandscapeLock();
      }
    };
    window.addEventListener('pointerdown', onTouchInteraction, { passive: true });
    return () => window.removeEventListener('pointerdown', onTouchInteraction);
  }, []);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.attachCanvases(mainCanvasRef.current, radarCanvasRef.current);
      engineRef.current.setHomePageActive(hud?.phase === 'TITLE' && !showLevelsPage);
    }
  }, [hud?.phase, showLevelsPage]);

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

  const handleOpenLevels = useCallback(() => {
    if (isMobileOrTouchDevice()) {
      void enterLandscapeMode({ requestFullscreen: true });
    }
    setShowLevelsPage(true);
  }, []);

  const handleStartMission = useCallback((level: number) => {
    if (isMobileOrTouchDevice()) {
      void enterLandscapeMode({ requestFullscreen: true });
    }
    setShowLevelsPage(false);
    setStoreMinimized(false);
    engineRef.current?.startNewCampaign(level);
  }, []);

  const handleStartTutorial = useCallback(() => {
    if (isMobileOrTouchDevice()) {
      void enterLandscapeMode({ requestFullscreen: true });
    }
    setShowLevelsPage(false);
    setStoreMinimized(false);
    engineRef.current?.startTutorial();
  }, []);

  const handleSkipTutorial = useCallback(() => {
    setStoreMinimized(false);
    engineRef.current?.skipTutorial();
  }, []);

  const handleSelectWeapon = useCallback((id: WeaponId) => {
    engineRef.current?.selectWeapon(id);
  }, []);

  const handleLaunchNextWave = useCallback(() => {
    setStoreMinimized(false);
    engineRef.current?.launchNextWaveEarly();
  }, []);

  const handleMainMenu = useCallback(() => {
    setShowLevelsPage(false);
    engineRef.current?.returnToTitle();
  }, []);

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

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden bg-[#0d1117] touch-none">
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
          onProceedNextLevel={() => engineRef.current?.proceedToNextLevelFromStoreOrComplete()}
          onMinimize={() => setStoreMinimized(true)}
        />
      )}

      {hud && (
        <OverlayModals
          hud={hud}
          onResume={() => engineRef.current?.resumeGame()}
          onOpenStoreAfterLevel={() => engineRef.current?.openStoreFromLevelComplete()}
          onNextLevel={() => engineRef.current?.proceedToNextLevelFromStoreOrComplete()}
          onPlayAgain={() => engineRef.current?.startNewCampaign(hud.level)}
          onMainMenu={handleMainMenu}
        />
      )}
    </div>
  );
}

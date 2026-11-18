import React, { useEffect, useRef, useState } from 'react';
import { Crosshair, Flame } from 'lucide-react';

interface TouchControllerProps {
  visible: boolean;
  onMove: (x: number, y: number) => void;
  onAim: (x: number, y: number, firing: boolean) => void;
  onFireButton: (firing: boolean) => void;
  onReset: () => void;
}

interface StickVisual {
  active: boolean;
  dx: number;
  dy: number;
  firing: boolean;
}

export const TouchController: React.FC<TouchControllerProps> = ({
  visible,
  onMove,
  onAim,
  onFireButton,
  onReset,
}) => {
  const movePointerId = useRef<number | null>(null);
  const moveCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const aimPointerId = useRef<number | null>(null);
  const aimCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const firePointerId = useRef<number | null>(null);

  const moveRadius = useRef<number>(48);
  const aimRadius = useRef<number>(48);

  const [moveVis, setMoveVis] = useState<StickVisual>({ active: false, dx: 0, dy: 0, firing: false });
  const [aimVis, setAimVis] = useState<StickVisual>({ active: false, dx: 0, dy: 0, firing: false });
  const [fireActive, setFireActive] = useState(false);

  useEffect(() => {
    if (!visible) {
      movePointerId.current = null;
      aimPointerId.current = null;
      firePointerId.current = null;
      setMoveVis({ active: false, dx: 0, dy: 0, firing: false });
      setAimVis({ active: false, dx: 0, dy: 0, firing: false });
      setFireActive(false);
      onReset();
    }
  }, [visible, onReset]);

  useEffect(() => {
    const handleGlobalReset = () => {
      movePointerId.current = null;
      aimPointerId.current = null;
      firePointerId.current = null;
      setMoveVis({ active: false, dx: 0, dy: 0, firing: false });
      setAimVis({ active: false, dx: 0, dy: 0, firing: false });
      setFireActive(false);
      onReset();
    };
    window.addEventListener('blur', handleGlobalReset);
    return () => window.removeEventListener('blur', handleGlobalReset);
  }, [onReset]);

  if (!visible) return null;

  // --- Left Movement Stick Handlers ---
  const handleMoveDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (movePointerId.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    movePointerId.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    moveRadius.current = Math.max(36, rect.width * 0.4);
    moveCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updateMoveFromPoint(e.clientX, e.clientY);
  };

  const updateMoveFromPoint = (clientX: number, clientY: number) => {
    const rawDx = clientX - moveCenter.current.x;
    const rawDy = clientY - moveCenter.current.y;
    const dist = Math.hypot(rawDx, rawDy);
    const maxTravel = moveRadius.current * 0.82;
    const clamped = Math.min(maxTravel, dist);
    const angle = Math.atan2(rawDy, rawDx);
    const visDx = dist > 0.5 ? Math.cos(angle) * clamped : 0;
    const visDy = dist > 0.5 ? Math.sin(angle) * clamped : 0;
    const normMag = Math.min(1, dist / moveRadius.current);
    const nx = dist > 6 ? Math.cos(angle) * normMag : 0;
    const ny = dist > 6 ? Math.sin(angle) * normMag : 0;

    setMoveVis({ active: true, dx: visDx, dy: visDy, firing: false });
    onMove(nx, ny);
  };

  const handleMoveMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== movePointerId.current) return;
    e.preventDefault();
    updateMoveFromPoint(e.clientX, e.clientY);
  };

  const handleMoveEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== movePointerId.current) return;
    e.preventDefault();
    movePointerId.current = null;
    setMoveVis({ active: false, dx: 0, dy: 0, firing: false });
    onMove(0, 0);
  };

  // --- Right Aim + Auto-Fire Stick Handlers ---
  const handleAimDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (aimPointerId.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    aimPointerId.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    aimRadius.current = Math.max(36, rect.width * 0.4);
    aimCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updateAimFromPoint(e.clientX, e.clientY);
  };

  const updateAimFromPoint = (clientX: number, clientY: number) => {
    const rawDx = clientX - aimCenter.current.x;
    const rawDy = clientY - aimCenter.current.y;
    const dist = Math.hypot(rawDx, rawDy);
    const maxTravel = aimRadius.current * 0.82;
    const clamped = Math.min(maxTravel, dist);
    const angle = Math.atan2(rawDy, rawDx);
    const visDx = dist > 0.5 ? Math.cos(angle) * clamped : 0;
    const visDy = dist > 0.5 ? Math.sin(angle) * clamped : 0;
    const normMag = Math.min(1, dist / aimRadius.current);
    const firing = normMag >= 0.3;

    setAimVis({ active: true, dx: visDx, dy: visDy, firing });
    if (normMag >= 0.14) {
      onAim(Math.cos(angle), Math.sin(angle), firing);
    } else {
      onAim(0, 0, false);
    }
  };

  const handleAimMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== aimPointerId.current) return;
    e.preventDefault();
    updateAimFromPoint(e.clientX, e.clientY);
  };

  const handleAimEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== aimPointerId.current) return;
    e.preventDefault();
    aimPointerId.current = null;
    setAimVis({ active: false, dx: 0, dy: 0, firing: false });
    onAim(0, 0, false);
  };

  // --- Dedicated Fire Button Handlers ---
  const handleFireDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (firePointerId.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    firePointerId.current = e.pointerId;
    setFireActive(true);
    onFireButton(true);
  };

  const handleFireEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerId !== firePointerId.current) return;
    e.preventDefault();
    firePointerId.current = null;
    setFireActive(false);
    onFireButton(false);
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 z-15 flex items-end justify-between px-3 pb-3 sm:px-5 sm:pb-4 md:px-6 md:pb-5"
      style={{
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Left Virtual Stick: Drive */}
      <div className="pointer-events-auto flex flex-col items-center gap-1">
        <div
          role="application"
          aria-label="Move Tank Joystick"
          onPointerDown={handleMoveDown}
          onPointerMove={handleMoveMove}
          onPointerUp={handleMoveEnd}
          onPointerCancel={handleMoveEnd}
          className={`relative w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 [@media(max-height:420px)]:w-28 [@media(max-height:420px)]:h-28 rounded-full border-2 flex items-center justify-center touch-none transition-colors ${
            moveVis.active
              ? 'border-sky-400/75 bg-[#0d1117]/60'
              : 'border-slate-500/45 bg-[#0d1117]/40'
          }`}
        >
          {/* Subtle cross ticks */}
          <span className="absolute top-2 w-1 h-2 rounded-full bg-slate-400/40" />
          <span className="absolute bottom-2 w-1 h-2 rounded-full bg-slate-400/40" />
          <span className="absolute left-2 w-2 h-1 rounded-full bg-slate-400/40" />
          <span className="absolute right-2 w-2 h-1 rounded-full bg-slate-400/40" />

          {/* Inner Thumb Puck */}
          <div
            className={`w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 [@media(max-height:420px)]:w-11 [@media(max-height:420px)]:h-11 rounded-full border-2 flex items-center justify-center shadow-lg transition-colors ${
              moveVis.active
                ? 'bg-sky-400/35 border-sky-300'
                : 'bg-slate-700/60 border-slate-400/60'
            }`}
            style={{
              transform: `translate3d(${moveVis.dx}px, ${moveVis.dy}px, 0)`,
            }}
          >
            <div className="w-3 h-3 rounded-full bg-white/80" />
          </div>
        </div>
        <span className="text-[10px] font-medium tracking-wide text-slate-400/90 uppercase leading-none">
          Drive
        </span>
      </div>

      {/* Right Virtual Controls: Quick Fire Button + Aim/Auto-Shoot Stick */}
      <div className="pointer-events-auto flex items-end gap-2.5 sm:gap-3.5">
        <div className="flex flex-col items-center gap-1 pb-5 sm:pb-6">
          <button
            type="button"
            aria-label="Fire Weapon"
            onPointerDown={handleFireDown}
            onPointerUp={handleFireEnd}
            onPointerCancel={handleFireEnd}
            className={`w-13 h-13 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full border-2 flex flex-col items-center justify-center touch-none transition-transform active:scale-95 ${
              fireActive
                ? 'bg-rose-500/50 border-rose-300 text-white'
                : 'bg-[#0d1117]/55 border-amber-500/65 text-amber-300'
            }`}
          >
            <Flame className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5 leading-none">
              Fire
            </span>
          </button>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div
            role="application"
            aria-label="Aim and Shoot Joystick"
            onPointerDown={handleAimDown}
            onPointerMove={handleAimMove}
            onPointerUp={handleAimEnd}
            onPointerCancel={handleAimEnd}
            className={`relative w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 [@media(max-height:420px)]:w-28 [@media(max-height:420px)]:h-28 rounded-full border-2 flex items-center justify-center touch-none transition-colors ${
              aimVis.firing
                ? 'border-amber-400/90 bg-amber-500/15'
                : aimVis.active
                ? 'border-amber-400/60 bg-[#0d1117]/60'
                : 'border-slate-500/45 bg-[#0d1117]/40'
            }`}
          >
            <Crosshair
              className={`w-5 h-5 sm:w-6 sm:h-6 pointer-events-none transition-opacity ${
                aimVis.active ? 'opacity-20' : 'opacity-45 text-amber-300'
              }`}
            />

            {/* Inner Aim Puck */}
            <div
              className={`absolute w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 [@media(max-height:420px)]:w-11 [@media(max-height:420px)]:h-11 rounded-full border-2 flex items-center justify-center shadow-lg transition-colors ${
                aimVis.firing
                  ? 'bg-amber-500/55 border-amber-300'
                  : aimVis.active
                  ? 'bg-amber-500/30 border-amber-400'
                  : 'bg-slate-700/60 border-amber-400/55'
              }`}
              style={{
                transform: `translate3d(${aimVis.dx}px, ${aimVis.dy}px, 0)`,
              }}
            >
              <Crosshair className="w-4 h-4 sm:w-5 sm:h-5 text-white/90" />
            </div>
          </div>
          <span className="text-[10px] font-medium tracking-wide text-slate-400/90 uppercase leading-none">
            Aim &amp; Shoot
          </span>
        </div>
      </div>
    </div>
  );
};

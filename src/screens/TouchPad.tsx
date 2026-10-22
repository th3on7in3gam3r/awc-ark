import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  directionAt,
  padHaptic,
  PAD_REPEAT_DELAY_MS,
  sendPadKey,
  type PadButton,
  type PadDirection,
  type PadKey,
  type PadLayout,
} from '../services/touchPad';

/**
 * Big, thumb-friendly controls under (or beside) the game.
 * - The D-pad follows your thumb: press anywhere on it and slide between directions.
 * - Each button tracks its own finger, so you can move and fire at the same time.
 */

type Held = { key: PadKey; delay?: number; every?: number };

/**
 * Claim every touch that starts on a control. Without this, iPhone/iPad Safari
 * treats a held or drifting thumb as a long-press: it highlights the pad and pops
 * up Copy / Save. React's touch handlers are passive, so this must be native.
 * Pointer events (what the pad listens to) still arrive.
 */
function useClaimTouches<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e: Event) => {
      if (e.cancelable) e.preventDefault();
    };
    const opts: AddEventListenerOptions = { passive: false };
    el.addEventListener('touchstart', stop, opts);
    el.addEventListener('touchmove', stop, opts);
    el.addEventListener('gesturestart', stop, opts);
    el.addEventListener('selectstart', stop);
    return () => {
      el.removeEventListener('touchstart', stop, opts);
      el.removeEventListener('touchmove', stop, opts);
      el.removeEventListener('gesturestart', stop, opts);
      el.removeEventListener('selectstart', stop);
    };
  }, []);
  return ref;
}

/** Press a key and keep repeating it while held (like holding a keyboard key). */
function useHeldKey() {
  const held = useRef<{ key: PadKey; timers: number[] } | null>(null);

  const release = useCallback(() => {
    const h = held.current;
    if (!h) return;
    held.current = null;
    h.timers.forEach((t) => window.clearTimeout(t));
    sendPadKey('keyup', h.key);
  }, []);

  const press = useCallback(
    ({ key, every }: Held) => {
      release();
      sendPadKey('keydown', key);
      padHaptic();
      const timers: number[] = [];
      if (every) {
        const start = window.setTimeout(() => {
          const id = window.setInterval(() => sendPadKey('keydown', key, true), every);
          timers.push(id);
        }, PAD_REPEAT_DELAY_MS);
        timers.push(start);
      }
      held.current = { key, timers };
    },
    [release]
  );

  // clearTimeout also clears intervals in browsers; release covers both.
  useEffect(() => release, [release]);
  return { press, release, current: held };
}

function DPad({ layout, size }: { layout: PadLayout; size: number }) {
  const { press, release } = useHeldKey();
  const touchRef = useClaimTouches<HTMLDivElement>();
  const [dir, setDir] = useState<PadDirection | null>(null);
  const dirRef = useRef<PadDirection | null>(null);
  const pointerRef = useRef<number | null>(null);

  const update = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const next = directionAt(e.clientX - rect.left, e.clientY - rect.top, rect.width, layout.directions);
      if (next === dirRef.current) return;
      dirRef.current = next;
      setDir(next);
      if (!next) {
        release();
        return;
      }
      const key = layout.keys[next];
      if (key) press({ key, every: layout.repeatDirections?.[next] });
    },
    [layout, press, release]
  );

  const end = useCallback(() => {
    pointerRef.current = null;
    dirRef.current = null;
    setDir(null);
    release();
  }, [release]);

  useEffect(() => {
    // Let go of everything if the app is hidden mid-press (call, notification).
    const onHide = () => end();
    window.addEventListener('blur', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('blur', onHide);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [end]);

  const has = (d: PadDirection) => layout.directions.includes(d);
  const arm = size / 3;

  const Arm = ({ d, style }: { d: PadDirection; style: React.CSSProperties }) => (
    <div
      aria-hidden="true"
      className={`absolute flex items-center justify-center rounded-[14px] transition-colors duration-75 ${
        has(d) ? (dir === d ? 'bg-ark-gold' : 'bg-[#3A1E24]') : 'bg-[#3A1E24]/35'
      }`}
      style={{ width: arm, height: arm, ...style }}
    >
      {has(d) ? (
        <svg pointerEvents="none" width={arm * 0.34} height={arm * 0.34} viewBox="0 0 24 24" fill="none" stroke={dir === d ? '#F2D98A' : '#E9DCCF'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${{ up: 0, right: 90, down: 180, left: 270 }[d]}deg)` }}>
          <path d="M6 15l6-6 6 6" />
        </svg>
      ) : null}
    </div>
  );

  const label = layout.directions.length === 4 ? 'Direction pad' : layout.directions.includes('left') ? 'Move left or right' : 'Move up or down';

  return (
    <div
      ref={touchRef}
      role="group"
      aria-label={label}
      className="relative shrink-0 touch-none select-none"
      style={{ width: size, height: size, WebkitTouchCallout: 'none' }}
      onPointerDown={(e) => {
        e.preventDefault();
        pointerRef.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => {
        if (pointerRef.current !== e.pointerId) return;
        update(e);
      }}
      onPointerUp={(e) => {
        if (pointerRef.current === e.pointerId) end();
      }}
      onPointerCancel={end}
      onLostPointerCapture={(e) => {
        if (pointerRef.current === e.pointerId) end();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Arm d="up" style={{ left: arm, top: 0 }} />
      <Arm d="left" style={{ left: 0, top: arm }} />
      <Arm d="right" style={{ left: arm * 2, top: arm }} />
      <Arm d="down" style={{ left: arm, top: arm * 2 }} />
      <div aria-hidden="true" className="absolute bg-[#3A1E24]" style={{ left: arm - 1, top: arm - 1, width: arm + 2, height: arm + 2 }}>
        <div className="absolute inset-[30%] rounded-full bg-[#2A1418]" />
      </div>
    </div>
  );
}

function ActionButton({ button, size }: { button: PadButton; size: number }) {
  const { press, release } = useHeldKey();
  const touchRef = useClaimTouches<HTMLButtonElement>();
  const [down, setDown] = useState(false);
  const pointerRef = useRef<number | null>(null);
  const primary = button.id === 'a';

  const end = useCallback(() => {
    pointerRef.current = null;
    setDown(false);
    release();
  }, [release]);

  useEffect(() => {
    const onHide = () => end();
    window.addEventListener('blur', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('blur', onHide);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [end]);

  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <button
        ref={touchRef}
        type="button"
        aria-label={button.hint}
        className={`touch-none select-none rounded-full font-arcade flex items-center justify-center transition-[transform,filter] duration-75 shadow-[0_5px_0_rgba(42,20,24,0.35),0_10px_18px_-10px_rgba(42,20,24,0.6)] ${
          primary ? 'bg-ark-gold text-white' : 'bg-[#A67C1E] text-white'
        } ${down ? 'translate-y-[3px] brightness-90 shadow-[0_2px_0_rgba(42,20,24,0.35)]' : ''}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.24), WebkitTouchCallout: 'none' }}
        onPointerDown={(e) => {
          e.preventDefault();
          pointerRef.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDown(true);
          press({ key: button.press, every: button.repeatMs });
        }}
        onPointerUp={(e) => {
          if (pointerRef.current === e.pointerId) end();
        }}
        onPointerCancel={end}
        onLostPointerCapture={(e) => {
          if (pointerRef.current === e.pointerId) end();
        }}
        onContextMenu={(e) => e.preventDefault()}
        // Keyboard users already have real keys; keep the pad out of the tab order.
        tabIndex={-1}
      >
        {button.label}
      </button>
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ark-muted">{button.hint}</span>
    </div>
  );
}

export function TouchPadControls({ layout, size }: { layout: PadLayout; size: number }) {
  return <DPad layout={layout} size={size} />;
}

export function TouchPadButtons({ layout, size }: { layout: PadLayout; size: number }) {
  // A sits lower-right like a console pad; B up and to the left of it.
  const b = layout.buttons.find((x) => x.id === 'b');
  const a = layout.buttons.find((x) => x.id === 'a');
  return (
    <div className="flex items-end gap-3 shrink-0">
      {b ? <div className="-translate-y-5"><ActionButton button={b} size={size} /></div> : null}
      {a ? <ActionButton button={a} size={size} /> : null}
    </div>
  );
}

/** Pad as one bar: D-pad on the left, buttons on the right (phone held upright). */
export function TouchPadBar({ layout, dpadSize, buttonSize }: { layout: PadLayout; dpadSize: number; buttonSize: number }) {
  return (
    <div className="shrink-0 flex items-center justify-between gap-4 px-2 sm:px-6" data-touch-pad="bar">
      <TouchPadControls layout={layout} size={dpadSize} />
      <TouchPadButtons layout={layout} size={buttonSize} />
    </div>
  );
}

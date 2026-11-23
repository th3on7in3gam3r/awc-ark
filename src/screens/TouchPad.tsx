import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  directionFromOffset,
  isTwoWay,
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

/**
 * The steering control. Its touch area fills the whole space it's given (the left
 * side of the controls), with the pad drawn in the middle, so a thumb that lands a
 * little off still steers. Direction is measured from the center of the drawn pad.
 */
function DPad({ layout, size }: { layout: PadLayout; size: number }) {
  const { press, release } = useHeldKey();
  const touchRef = useClaimTouches<HTMLDivElement>();
  const visualRef = useRef<HTMLDivElement | null>(null);
  const [dir, setDir] = useState<PadDirection | null>(null);
  const dirRef = useRef<PadDirection | null>(null);
  const pointerRef = useRef<number | null>(null);
  const twoWay = isTwoWay(layout);

  const update = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const box = (visualRef.current || e.currentTarget).getBoundingClientRect();
      const dx = e.clientX - (box.left + box.width / 2);
      const dy = e.clientY - (box.top + box.height / 2);
      const next = directionFromOffset(dx, dy, size, layout.directions, dirRef.current);
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
    [layout, press, release, size]
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

  const label = layout.style === 'thumbstick' ? 'Four-direction joystick' : !twoWay ? 'Direction pad' : layout.directions.includes('left') ? 'Move left or right' : 'Move up or down';

  return (
    <div
      ref={touchRef}
      role="group"
      aria-label={label}
      data-dir={dir || ''}
      className="relative w-full h-full flex items-center justify-center touch-none select-none"
      style={{ minWidth: size, minHeight: twoWay ? size * 0.7 : size, WebkitTouchCallout: 'none' }}
      onPointerDown={(e) => {
        e.preventDefault();
        if (pointerRef.current !== null) return; // one thumb steers at a time
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
      onPointerCancel={(e) => {
        if (pointerRef.current === e.pointerId) end();
      }}
      onLostPointerCapture={(e) => {
        if (pointerRef.current === e.pointerId) end();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={visualRef} className="pointer-events-none">
        {layout.style === 'thumbstick' ? <Thumbstick size={size} dir={dir} />
          : twoWay ? <Rocker layout={layout} size={size} dir={dir} /> : <Thumbstick size={size} dir={dir} />}
      </div>
    </div>
  );
}

const ARROW_TURN: Record<PadDirection, number> = { up: 0, right: 90, down: 180, left: 270 };

function Arrow({ d, px, on }: { d: PadDirection; px: number; on: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke={on ? '#F2D98A' : '#E9DCCF'}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: `rotate(${ARROW_TURN[d]}deg)` }}
    >
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}

/**
 * Left/right (or up/down) games: one wide bar split in two. Every touch is one side
 * or the other, and the pressed side lights up and the bar tips toward it, so you
 * can tell which way you're going from the corner of your eye.
 */
function Rocker({ layout, size, dir }: { layout: PadLayout; size: number; dir: PadDirection | null }) {
  const vertical = layout.directions.includes('up');
  const [first, second] = vertical ? (['up', 'down'] as const) : (['left', 'right'] as const);
  const long = Math.round(size * 1.35);
  const short = Math.round(size * 0.66);
  const tilt = dir === first ? -1 : dir === second ? 1 : 0;
  const half = (d: PadDirection) => (
    <div
      className={`flex-1 flex items-center justify-center transition-colors duration-75 ${dir === d ? 'bg-ark-gold' : 'bg-[#3A1E24]'}`}
    >
      <Arrow d={d} px={Math.round(short * 0.42)} on={dir === d} />
    </div>
  );
  return (
    <div
      className={`flex ${vertical ? 'flex-col' : 'flex-row'} overflow-hidden rounded-full shadow-[0_6px_0_rgba(42,20,24,0.28),0_12px_20px_-12px_rgba(42,20,24,0.6)] transition-transform duration-75`}
      style={{
        width: vertical ? short : long,
        height: vertical ? long : short,
        transform: vertical ? `translateY(${tilt * 3}px)` : `translateX(${tilt * 3}px)`,
      }}
    >
      {half(first)}
      <div className={vertical ? 'h-[2px] bg-[#2A1418]' : 'w-[2px] bg-[#2A1418]'} />
      {half(second)}
    </div>
  );
}

/** A four-direction version of the arcade rocker for Snake. */
function Thumbstick({ size, dir }: { size: number; dir: PadDirection | null }) {
  const offset = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] } as const;
  const [dx, dy] = dir ? offset[dir] : [0, 0];
  const reach = size * 0.32;
  return (
    <div
      className="relative rounded-full border border-ark-line bg-[#3A1E24] shadow-[0_6px_0_rgba(42,20,24,0.28),0_12px_20px_-12px_rgba(42,20,24,0.6)]"
      style={{ width: size, height: size }}
    >
      {(Object.keys(offset) as PadDirection[]).map((direction) => {
        const [x, y] = offset[direction];
        return (
          <span
            key={direction}
            className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-colors duration-75 ${dir === direction ? 'bg-[#713c46]' : ''}`}
            style={{ left: size / 2 + x * reach, top: size / 2 + y * reach, width: size * 0.28, height: size * 0.28 }}
          >
            <Arrow d={direction} px={size * 0.17} on={dir === direction} />
          </span>
        );
      })}
      <span
        className="absolute rounded-full border border-white/15 bg-ark-gold shadow-[0_3px_0_#9c691e] transition-transform duration-75"
        style={{ left: '36%', top: '36%', width: '28%', height: '28%', transform: `translate(${dx * size * 0.09}px, ${dy * size * 0.09}px)` }}
      />
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

/** Pad as one bar (phone/tablet upright): steering zone fills the left side, buttons on the right. */
/** How tall the steering pad draws: Pong's up/down rocker is taller than it is wide. */
export function padDrawnHeight(layout: PadLayout, size: number): number {
  const verticalRocker = isTwoWay(layout) && layout.directions.includes('up');
  return verticalRocker ? Math.round(size * 1.35) : size;
}

export function TouchPadBar({ layout, dpadSize, buttonSize }: { layout: PadLayout; dpadSize: number; buttonSize: number }) {
  // The bar is as tall as the pad actually draws, so it never spills over the game or text.
  return (
    <div className="shrink-0 flex items-stretch gap-4 px-2 sm:px-6" style={{ height: padDrawnHeight(layout, dpadSize) + 8 }} data-touch-pad="bar">
      <div className="flex-1 min-w-0">
        <TouchPadControls layout={layout} size={dpadSize} />
      </div>
      <div className="shrink-0 flex items-center">
        <TouchPadButtons layout={layout} size={buttonSize} />
      </div>
    </div>
  );
}

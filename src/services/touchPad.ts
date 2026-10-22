import type { GameKey } from '../lib/games';

/**
 * On-screen controls for phones and tablets.
 *
 * The pad drives each game through the same keyboard controls a computer uses,
 * so every game already understands it and nothing in the game loops changes.
 */

export type PadDirection = 'up' | 'down' | 'left' | 'right';

export type PadKey = { key: string; code: string };

export type PadButton = {
  id: 'a' | 'b';
  label: string;
  /** Short word under the button, e.g. "Fire". */
  hint: string;
  press: PadKey;
  /** Keep firing while held, like holding a key down. */
  repeatMs?: number;
};

export type PadLayout = {
  /** Directions the D-pad uses for this game. */
  directions: PadDirection[];
  keys: Partial<Record<PadDirection, PadKey>>;
  /** Directions that keep stepping while held (Tetris moves). Others hold as one press. */
  repeatDirections?: Partial<Record<PadDirection, number>>;
  buttons: PadButton[];
};

const KEY = {
  left: { key: 'ArrowLeft', code: 'ArrowLeft' },
  right: { key: 'ArrowRight', code: 'ArrowRight' },
  up: { key: 'ArrowUp', code: 'ArrowUp' },
  down: { key: 'ArrowDown', code: 'ArrowDown' },
  space: { key: ' ', code: 'Space' },
  w: { key: 'w', code: 'KeyW' },
  s: { key: 's', code: 'KeyS' },
} satisfies Record<string, PadKey>;

export const PAD_LAYOUTS: Record<GameKey, PadLayout> = {
  // Player 1 paddle is W/S: the arrow keys belong to player 2 in 2-player mode.
  pong: {
    directions: ['up', 'down'],
    keys: { up: KEY.w, down: KEY.s },
    buttons: [{ id: 'a', label: 'A', hint: 'Start / Laser', press: KEY.space }],
  },
  breakout: {
    directions: ['left', 'right'],
    keys: { left: KEY.left, right: KEY.right },
    buttons: [{ id: 'a', label: 'A', hint: 'Start / Laser', press: KEY.space }],
  },
  invaders: {
    directions: ['left', 'right'],
    keys: { left: KEY.left, right: KEY.right },
    buttons: [{ id: 'a', label: 'A', hint: 'Fire', press: KEY.space, repeatMs: 220 }],
  },
  tetris: {
    directions: ['up', 'down', 'left', 'right'],
    keys: { up: KEY.up, down: KEY.down, left: KEY.left, right: KEY.right },
    repeatDirections: { left: 110, right: 110, down: 55 },
    buttons: [
      { id: 'b', label: 'B', hint: 'Rotate', press: KEY.up },
      { id: 'a', label: 'A', hint: 'Drop', press: KEY.space },
    ],
  },
};

/** Delay before a held control starts repeating, like a keyboard. */
export const PAD_REPEAT_DELAY_MS = 200;

/**
 * Which direction a finger is pressing, from its offset (dx, dy) to the pad's center.
 *
 * Left/right (or up/down) games have NO dead zone: every touch is one side or the
 * other, so a thumb never lands on "nothing". To stop flicker when a thumb rests on
 * the middle line, the current direction is kept until the thumb clearly crosses it.
 * The 4-way Tetris pad keeps a small dead zone in the middle.
 */
export function directionFromOffset(
  dx: number,
  dy: number,
  size: number,
  allowed: readonly PadDirection[],
  current: PadDirection | null = null
): PadDirection | null {
  const horizontal = allowed.includes('left') || allowed.includes('right');
  const vertical = allowed.includes('up') || allowed.includes('down');
  const hold = size * 0.06; // how far past the middle before switching sides

  if (horizontal && !vertical) {
    if ((current === 'left' && dx < hold) || (current === 'right' && dx > -hold)) return current;
    return dx < 0 ? 'left' : 'right';
  }
  if (vertical && !horizontal) {
    if ((current === 'up' && dy < hold) || (current === 'down' && dy > -hold)) return current;
    return dy < 0 ? 'up' : 'down';
  }

  if (Math.hypot(dx, dy) < size * 0.12) return null;
  const dir: PadDirection = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
  return allowed.includes(dir) ? dir : null;
}

/** Same as directionFromOffset, from a point inside a square pad of the given size. */
export function directionAt(
  x: number,
  y: number,
  size: number,
  allowed: readonly PadDirection[],
  current: PadDirection | null = null
): PadDirection | null {
  return directionFromOffset(x - size / 2, y - size / 2, size, allowed, current);
}

/** Left/right-only or up/down-only games get the two-sided rocker instead of a cross. */
export function isTwoWay(layout: PadLayout): boolean {
  return layout.directions.length === 2;
}

/** Send a key press or release to the game, exactly like a real keyboard. */
export function sendPadKey(type: 'keydown' | 'keyup', k: PadKey, repeat = false): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new KeyboardEvent(type, { key: k.key, code: k.code, repeat, bubbles: true, cancelable: true }));
}

/** Small buzz on press, where the phone supports it. */
export function padHaptic(): void {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* ignore */
  }
}

export const PAD_PREF_KEY = 'awc.ark.touchPad';

/**
 * Whether to show the pad. Touch screens get it by default; computers with a
 * mouse and keyboard don't, but anyone can turn it on or off and we remember.
 */
export function shouldShowPad(saved: string | null, touchScreen: boolean): boolean {
  if (saved === 'on') return true;
  if (saved === 'off') return false;
  return touchScreen;
}

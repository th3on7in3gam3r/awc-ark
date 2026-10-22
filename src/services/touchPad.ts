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
  c: { key: 'c', code: 'KeyC' },
} satisfies Record<string, PadKey>;

export const PAD_LAYOUTS: Record<GameKey, PadLayout> = {
  // Player 1 paddle is W/S: the arrow keys belong to player 2 in 2-player mode.
  pong: {
    directions: ['up', 'down'],
    keys: { up: KEY.w, down: KEY.s },
    buttons: [{ id: 'a', label: 'A', hint: 'Laser', press: KEY.space }],
  },
  breakout: {
    directions: ['left', 'right'],
    keys: { left: KEY.left, right: KEY.right },
    buttons: [{ id: 'a', label: 'A', hint: 'Launch', press: KEY.space }],
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
      { id: 'b', label: 'B', hint: 'Hold', press: KEY.c },
      { id: 'a', label: 'A', hint: 'Drop', press: KEY.space },
    ],
  },
};

/** Delay before a held control starts repeating, like a keyboard. */
export const PAD_REPEAT_DELAY_MS = 200;

/**
 * Which direction a finger at (x, y) is pressing on a D-pad of the given size.
 * The middle is a small dead zone; a finger can slide between directions.
 */
export function directionAt(
  x: number,
  y: number,
  size: number,
  allowed: readonly PadDirection[]
): PadDirection | null {
  const half = size / 2;
  const dx = x - half;
  const dy = y - half;
  const dead = size * 0.12;
  if (Math.hypot(dx, dy) < dead) return null;

  const horizontal = allowed.includes('left') || allowed.includes('right');
  const vertical = allowed.includes('up') || allowed.includes('down');

  let dir: PadDirection;
  if (horizontal && !vertical) dir = dx < 0 ? 'left' : 'right';
  else if (vertical && !horizontal) dir = dy < 0 ? 'up' : 'down';
  else if (Math.abs(dx) >= Math.abs(dy)) dir = dx < 0 ? 'left' : 'right';
  else dir = dy < 0 ? 'up' : 'down';

  return allowed.includes(dir) ? dir : null;
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

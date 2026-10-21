export const GAMES = ['pong', 'breakout', 'invaders', 'tetris'] as const;
export type GameKey = (typeof GAMES)[number];

export const GAME_INFO: Record<GameKey, { title: string; short: string; blurb: string; prototypeId: string }> = {
  pong: { title: 'Pong Plus', short: 'Pong', blurb: 'Power-ups, lasers, and 2-player on one screen', prototypeId: 'pong-plus' },
  breakout: { title: 'Breakout', short: 'Breakout', blurb: 'Smash every brick', prototypeId: 'breakout' },
  invaders: { title: 'Space Invaders', short: 'Invaders', blurb: 'Hold the line', prototypeId: 'space-invaders' },
  tetris: { title: 'Tetris', short: 'Tetris', blurb: 'Clear the lines', prototypeId: 'tetris' },
};

export function gameFromPrototypeId(id: string): GameKey | null {
  const hit = (Object.keys(GAME_INFO) as GameKey[]).find((k) => GAME_INFO[k].prototypeId === id);
  return hit || null;
}

export function isGameKey(v: unknown): v is GameKey {
  return typeof v === 'string' && (GAMES as readonly string[]).includes(v);
}

export function formatScore(n: number | null | undefined): string {
  return typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
}

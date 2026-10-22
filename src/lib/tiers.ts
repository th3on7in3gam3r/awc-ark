/**
 * Skill tiers: Beginner, Intermediate, Advanced.
 *
 * Intermediate is exactly how the games played before tiers existed, so nobody's
 * game gets harder without choosing it. Beginner slows things down and gives more
 * room for mistakes; Advanced speeds things up and tightens the margins.
 * The choice is remembered per player, so a child and a parent on the same
 * device each keep their own.
 */

export const TIERS = ['beginner', 'intermediate', 'advanced'] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_INFO: Record<Tier, { label: string; blurb: string; code: number }> = {
  beginner: { label: 'Beginner', blurb: 'Slower, with extra lives. Great for learning.', code: 1 },
  intermediate: { label: 'Intermediate', blurb: 'The classic speed.', code: 2 },
  advanced: { label: 'Advanced', blurb: 'Faster and tougher. For the champions.', code: 3 },
};

export type TierTuning = {
  /** Space Invaders: how fast the aliens march (multiplies their step speed). */
  alienSpeed: number;
  /** Space Invaders: chance per frame an alien fires, and how fast its shots fall. */
  alienFireChance: number;
  alienShotSpeed: number;
  /** Breakout: ball speed and paddle width. */
  ballSpeed: number;
  paddleWidth: number;
  /** Space Invaders and Breakout: lives at the start. */
  lives: number;
  /** Tetris: how long each step down takes (higher is slower). */
  dropTime: number;
  /** Pong: computer opponent. */
  pongAi: 'easy' | 'medium' | 'hard';
};

export const TIER_TUNING: Record<Tier, TierTuning> = {
  beginner: {
    alienSpeed: 0.7,
    alienFireChance: 0.02,
    alienShotSpeed: 3.2,
    ballSpeed: 0.75,
    paddleWidth: 120,
    lives: 5,
    dropTime: 1.4,
    pongAi: 'easy',
  },
  intermediate: {
    alienSpeed: 1,
    alienFireChance: 0.04,
    alienShotSpeed: 4.5,
    ballSpeed: 1,
    paddleWidth: 90,
    lives: 3,
    dropTime: 1,
    pongAi: 'medium',
  },
  advanced: {
    alienSpeed: 1.3,
    alienFireChance: 0.06,
    alienShotSpeed: 5.6,
    ballSpeed: 1.25,
    paddleWidth: 72,
    lives: 3,
    dropTime: 0.7,
    pongAi: 'hard',
  },
};

export function isTier(v: unknown): v is Tier {
  return typeof v === 'string' && (TIERS as readonly string[]).includes(v);
}

const tierKey = (playerId: string) => `awc.ark.tier.${playerId}`;

export function loadTier(playerId: string): Tier {
  try {
    const saved = localStorage.getItem(tierKey(playerId));
    return isTier(saved) ? saved : 'intermediate';
  } catch {
    return 'intermediate';
  }
}

export function saveTier(playerId: string, tier: Tier): void {
  try {
    localStorage.setItem(tierKey(playerId), tier);
  } catch {
    /* private mode */
  }
}

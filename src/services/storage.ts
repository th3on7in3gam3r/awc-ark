/**
 * Stand-in for the AI Studio prototype's local "storage" service.
 * The games call storage.addHighScore(...) when a game ends; the Ark listens and
 * sends the score to the church leaderboard (AWC Vault). Achievements, chat and
 * "cloud sync" from the prototype were not real and are gone.
 */
export type GameFinish = {
  gameId: string;
  score: number;
  levelReached?: number;
  twoPlayer?: boolean;
  stats?: Record<string, number | undefined>;
  [key: string]: unknown;
};

type Listener = (finish: GameFinish) => void;
let listener: Listener | null = null;

export const storage = {
  addHighScore(entry: GameFinish) {
    try {
      listener?.(entry);
    } catch (err) {
      console.error('[ark] finish listener', err);
    }
    return {
      ...entry,
      id: `local_${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      verified: false,
    } as any;
  },
  /** Prototype achievements are retired; AWC Bucks replace them. */
  unlockAchievement(_id: string): { title: string; xp: number } | null {
    return null;
  },
  updateAchievementProgress(_id: string, _progress: number): { title: string; xp: number } | null {
    return null;
  },
};

/** The Ark's game screen subscribes here while a game is open. */
export function onGameFinish(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

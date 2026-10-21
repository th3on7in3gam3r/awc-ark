import { supabase, isSupabaseConfigured } from './supabase';
import type { GameKey } from './games';

/** Same-origin bridge in AWC Connect (/api/ark) → AWC Vault (resource=ark). */
const API = '/api/ark';

export class ArkError extends Error {
  constructor(message: string, public status = 0, public code = 'error') {
    super(message);
  }
}

export type ArkPlayer = {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  isChild: boolean;
  self: boolean;
  bests: Partial<Record<GameKey, number>>;
  /** AWC Bucks earned from playing this week (kids only; null for adults). */
  bucksThisWeek: number | null;
};

export type ArkMe = {
  settings: { bucksEnabled: boolean; weeklyCap: number };
  players: ArkPlayer[];
  isStaff: boolean;
};

export type BoardEntry = {
  rank: number;
  playerId: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  score: number;
  mine: boolean;
};

export type ArkBoard = {
  game: GameKey;
  period: 'week' | 'all';
  entries: BoardEntry[];
  mine: Array<{ playerId: string; rank: number; score: number }>;
  players: number;
};

export type ScoreResult = {
  scoreId: string;
  status: 'ok' | 'held';
  newBest: boolean;
  previousBest: number | null;
  weekRank: number | null;
  bucks: Array<{ label: string; amount: number }>;
  bucksThisWeek: number | null;
  weeklyCap: number;
  capped: boolean;
  bucksEnabled: boolean;
};

export async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || null;
  return token && token.split('.').length === 3 ? token : null;
}

async function request<T>(method: 'GET' | 'POST', query: Record<string, string>, body?: unknown): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new ArkError('Please sign in to AWC Connect first.', 401, 'signed_out');
  const qs = new URLSearchParams(query).toString();
  let res: Response;
  try {
    res = await fetch(`${API}?${qs}`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ArkError('You seem to be offline. Check your connection and try again.', 0, 'offline');
  }
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || data?.ok !== true) {
    throw new ArkError(data?.error || 'The Ark is not available right now. Please try again.', res.status, data?.code || 'error');
  }
  return data as T;
}

export const arkApi = {
  me: () => request<ArkMe>('GET', { action: 'me' }),
  board: (game: GameKey, period: 'week' | 'all') => request<ArkBoard>('GET', { action: 'board', game, period }),
  submit: (input: { playerId: string; game: GameKey; score: number; durationSec: number; stats?: Record<string, number> }) =>
    request<ScoreResult>('POST', { action: 'score' }, input),
};

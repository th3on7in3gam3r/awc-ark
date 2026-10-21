import React, { useEffect, useState } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import { arkApi, ArkError, type ArkBoard } from '../lib/api';
import { GAMES, GAME_INFO, formatScore, type GameKey } from '../lib/games';
import { go } from '../lib/route';
import { Avatar, BackLink } from './ui';

export function Leaderboard({ game }: { game: GameKey }) {
  const [period, setPeriod] = useState<'week' | 'all'>('week');
  const [board, setBoard] = useState<ArkBoard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setBoard(null);
    setError(null);
    arkApi
      .board(game, period)
      .then((b) => alive && setBoard(b))
      .catch((err) => alive && setError(err instanceof ArkError ? err.message : 'Couldn’t load the board.'));
    return () => {
      alive = false;
    };
  }, [game, period]);

  const podium = board?.entries.slice(0, 3) || [];
  const rest = board?.entries.slice(3) || [];
  const order = [podium[1], podium[0], podium[2]];
  const heights = ['h-[76px]', 'h-[104px]', 'h-[58px]'];
  const places = [2, 1, 3];
  const offBoard = board?.mine.filter((m) => m.rank > (board?.entries.length || 0)) || [];

  return (
    <main className="mx-auto w-full max-w-[560px] px-5 pt-4 pb-10 flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <BackLink href="#/" label="Back to the Ark" />
        <h1 className="m-0 font-arcade text-sm leading-relaxed text-ark-gold">ARK CHAMPIONS</h1>
      </header>

      <div role="tablist" aria-label="Game" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {GAMES.map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={g === game}
            onClick={() => go(`/board/${g}`)}
            className={`h-10 px-3.5 rounded-full whitespace-nowrap text-[13px] font-bold ${
              g === game ? 'bg-ark-gold text-ark-wine' : 'border border-ark-line text-ark-muted'
            }`}
          >
            {GAME_INFO[g].short}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 p-1 rounded-[14px] bg-ark-panel" role="group" aria-label="Period">
        {(['week', 'all'] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={period === p}
            onClick={() => setPeriod(p)}
            className={`h-10 rounded-[10px] text-sm font-bold ${period === p ? 'bg-ark-line text-ark-cream' : 'text-ark-muted'}`}
          >
            {p === 'week' ? 'This week' : 'All time'}
          </button>
        ))}
      </div>

      {error ? <p className="m-0 rounded-2xl bg-ark-panel p-4 text-sm" role="alert">{error}</p> : null}
      {!board && !error ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-ark-gold" aria-label="Loading" /></div>
      ) : null}

      {board && board.entries.length === 0 ? (
        <div className="rounded-2xl bg-ark-panel border border-ark-line p-6 text-center flex flex-col gap-3 items-center">
          <p className="m-0 font-bold">No scores yet{period === 'week' ? ' this week' : ''}.</p>
          <a href={`#/play/${game}`} className="h-11 px-5 rounded-xl bg-ark-gold text-ark-wine font-extrabold inline-flex items-center">
            Play {GAME_INFO[game].title}
          </a>
        </div>
      ) : null}

      {board && podium.length ? (
        <ol className="m-0 p-0 list-none grid grid-cols-3 gap-2 items-end" aria-label="Top 3">
          {order.map((e, i) =>
            e ? (
              <li key={e.playerId} className="flex flex-col items-center gap-2">
                <Avatar name={e.name} initials={e.initials} url={e.avatarUrl} size={places[i] === 1 ? 64 : 52} highlight={e.mine || places[i] === 1} />
                <span className="text-[13px] font-bold text-center leading-tight">{e.name}</span>
                {e.hidden ? <span className="text-[10px] text-ark-muted text-center leading-tight -mt-1">Others see “Player {e.initials[0]}.”</span> : null}
                <span
                  className={`w-full ${heights[i]} rounded-t-xl flex flex-col items-center justify-center gap-1 ${
                    places[i] === 1 ? 'bg-ark-raised border-[1.5px] border-b-0 border-ark-gold' : 'bg-ark-panel'
                  }`}
                >
                  <span className={`font-arcade ${places[i] === 1 ? 'text-lg text-ark-gold' : 'text-sm text-ark-muted'}`}>{places[i]}</span>
                  <span className="text-xs font-extrabold tabular-nums">{formatScore(e.score)}</span>
                </span>
              </li>
            ) : (
              <li key={`empty-${i}`} aria-hidden="true" />
            )
          )}
        </ol>
      ) : null}

      {rest.length || offBoard.length ? (
        <ol className="m-0 p-0 list-none rounded-[18px] bg-ark-panel border border-ark-line overflow-hidden" start={4}>
          {rest.map((e) => (
            <li key={e.playerId} className={`flex items-center gap-3 px-4 py-3.5 border-t border-ark-raised first:border-t-0 ${e.mine ? 'bg-ark-raised' : ''}`}>
              <span className="w-7 font-arcade text-[11px] text-ark-muted">{e.rank}</span>
              <Avatar name={e.name} initials={e.initials} url={e.avatarUrl} size={36} highlight={e.mine} />
              <span className="flex-1 min-w-0">
                <span className="block font-bold truncate">{e.name}</span>
                {e.hidden ? <span className="block text-[11px] text-ark-muted">Others see “Player {e.initials[0]}.”</span> : null}
              </span>
              <span className="font-extrabold tabular-nums">{formatScore(e.score)}</span>
            </li>
          ))}
          {offBoard.map((m) => (
            <li key={m.playerId} className="flex items-center gap-3 px-4 py-3.5 border-t border-ark-raised bg-ark-raised">
              <span className="w-7 font-arcade text-[11px] text-ark-gold">{m.rank}</span>
              <span className="flex-1 font-bold">Your family</span>
              <span className="font-extrabold tabular-nums">{formatScore(m.score)}</span>
            </li>
          ))}
        </ol>
      ) : null}

      <p className="m-0 rounded-[14px] bg-ark-panel px-4 py-3.5 flex gap-2.5 items-start text-[13px] leading-relaxed text-ark-muted">
        <Clock className="w-[18px] h-[18px] shrink-0 mt-0.5 text-ark-teal" aria-hidden="true" />
        The weekly board starts fresh every Monday. The top 3 kids in each game earn AWC Bucks. Names come from AWC Connect. Parents can hide a child’s name in “Who’s playing?”.
      </p>
    </main>
  );
}

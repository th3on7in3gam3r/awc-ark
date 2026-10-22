import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { arkApi, type ArkBoard, type ArkMe, type ArkPlayer } from '../lib/api';
import { GAMES, GAME_INFO, formatScore, type GameKey } from '../lib/games';
import { ArkMark, Avatar, BucksCoin } from './ui';
import { GameArt } from './GameArt';

const FEATURED_KEY = 'awc.ark.lastGame';

export function Home({ me, player, onPickPlayer }: { me: ArkMe; player: ArkPlayer | null; onPickPlayer: () => void }) {
  const [featured] = useState<GameKey>(() => {
    try {
      const g = localStorage.getItem(FEATURED_KEY) as GameKey | null;
      return g && (GAMES as readonly string[]).includes(g) ? g : 'tetris';
    } catch {
      return 'tetris';
    }
  });
  const [board, setBoard] = useState<ArkBoard | null>(null);

  useEffect(() => {
    let alive = true;
    arkApi.board(featured, 'week').then((b) => alive && setBoard(b)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [featured]);

  const showBucks = Boolean(player?.isChild && me.settings.bucksEnabled);
  const earned = player?.bucksThisWeek || 0;
  const cap = me.settings.weeklyCap || 20;
  const others = me.players.length > 1;
  const myRow = board?.mine.find((m) => m.playerId === player?.id);

  return (
    <main className="mx-auto w-full max-w-[560px] px-5 pt-6 pb-10 flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ArkMark />
          <div>
            <h1 className="m-0 font-arcade text-[15px] tracking-wide text-ark-gold">AWC ARK</h1>
            <p className="m-0 mt-1.5 text-[11px] font-semibold text-ark-muted">Anointed Worship Center</p>
          </div>
        </div>
        {player ? (
          <button
            type="button"
            onClick={onPickPlayer}
            aria-label={`Playing as ${player.name}. Change player or sign out`}
            className="flex items-center gap-2 rounded-full bg-ark-panel border border-ark-line pl-1 pr-3 h-12"
          >
            <Avatar name={player.name} initials={player.initials} url={player.avatarUrl} size={40} highlight />
            <span className="text-left leading-tight">
              <span className="block text-[11px] text-ark-muted">{others ? 'Playing as' : 'Player'}</span>
              <span className="block text-[13px] font-bold max-w-[110px] truncate">{player.self ? 'You' : player.name}</span>
            </span>
            <ChevronDown className="w-4 h-4 text-ark-gold" aria-hidden="true" />
          </button>
        ) : null}
      </header>

      {showBucks ? (
        <section aria-label="AWC Bucks from the Ark" className="rounded-[20px] bg-ark-panel border border-ark-line p-4 flex items-center gap-3.5">
          <BucksCoin />
          <div className="flex-1">
            <p className="m-0 text-[12px] font-bold tracking-[0.12em] text-ark-muted">AWC BUCKS FROM THE ARK</p>
            <p className="m-0 mt-1 text-xl font-extrabold">
              {earned} <span className="text-sm font-semibold text-ark-muted">of {cap} this week</span>
            </p>
            <div className="mt-2 h-2 rounded bg-ark-line overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={earned}>
              <div className="h-full bg-ark-gold" style={{ width: `${Math.min(100, Math.round((earned / Math.max(1, cap)) * 100))}%` }} />
            </div>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="pick-title" className="flex flex-col gap-3">
        <h2 id="pick-title" className="m-0 font-arcade text-[11px] text-ark-teal">PICK A GAME</h2>
        <div className="grid grid-cols-2 gap-3">
          {GAMES.map((g) => {
            const best = player?.bests?.[g];
            const isTop = myRow && featured === g && myRow.rank <= 3;
            return (
              <a
                key={g}
                href={`#/play/${g}`}
                className={`no-underline text-ark-cream bg-ark-panel rounded-[18px] p-3 flex flex-col gap-2.5 border ${isTop ? 'border-ark-gold' : 'border-ark-line'}`}
              >
                <GameArt game={g} />
                <span>
                  <span className="block font-extrabold text-[15px]">{GAME_INFO[g].title}</span>
                  <span className={`block mt-0.5 text-xs ${isTop ? 'text-ark-gold' : 'text-ark-muted'}`}>
                    {best != null ? `Best ${formatScore(best)}${isTop ? ` · #${myRow!.rank} this week` : ''}` : 'Not played yet'}
                  </span>
                </span>
              </a>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="champs-title" className="rounded-[20px] bg-ark-panel border border-ark-line p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="champs-title" className="m-0 font-arcade text-[10px] leading-relaxed text-ark-teal">
            ARK CHAMPIONS · {GAME_INFO[featured].short.toUpperCase()} THIS WEEK
          </h2>
          <a href={`#/board/${featured}`} className="text-[13px] font-bold text-ark-gold min-h-11 flex items-center">
            See all
          </a>
        </div>
        {!board ? (
          <p className="m-0 text-sm text-ark-muted">Loading…</p>
        ) : board.entries.length === 0 ? (
          <p className="m-0 text-sm text-ark-muted">No scores yet this week. Be the first on the board!</p>
        ) : (
          <ol className="m-0 p-0 list-none flex flex-col gap-1.5">
            {board.entries.slice(0, 3).map((e) => (
              <li key={e.playerId} className={`flex items-center gap-3 rounded-xl px-2 py-1.5 -mx-2 ${e.mine ? 'bg-ark-raised' : ''}`}>
                <span className="w-7 font-arcade text-xs text-ark-gold">{e.rank}</span>
                <Avatar name={e.name} initials={e.initials} url={e.avatarUrl} size={34} highlight={e.mine} />
                <span className="flex-1 font-bold truncate">{e.name}</span>
                <span className="font-extrabold tabular-nums">{formatScore(e.score)}</span>
              </li>
            ))}
            {myRow && myRow.rank > 3 ? (
              <li className="flex items-center gap-3 rounded-xl px-2 py-1.5 -mx-2 bg-ark-raised">
                <span className="w-7 font-arcade text-xs text-ark-gold">{myRow.rank}</span>
                <Avatar name={player?.name || ''} initials={player?.initials || ''} url={player?.avatarUrl || null} size={34} highlight />
                <span className="flex-1 font-bold">You</span>
                <span className="font-extrabold tabular-nums">{formatScore(myRow.score)}</span>
              </li>
            ) : null}
          </ol>
        )}
      </section>

      {me.settings.bucksEnabled ? (
        <section aria-labelledby="earn-title" className="flex flex-col gap-2.5">
          <h2 id="earn-title" className="m-0 font-arcade text-[11px] text-ark-teal">EARN AWC BUCKS</h2>
          {[
            ['First game of the day', '+2'],
            ['Beat your best score', '+5'],
            ['Finish the week in the top 3', '+4 to +10'],
          ].map(([label, amount]) => (
            <div key={label} className="flex items-center justify-between rounded-[14px] bg-ark-panel border border-ark-line px-3.5 py-3">
              <span className="text-sm font-semibold">{label}</span>
              <span className="font-extrabold text-ark-gold">{amount}</span>
            </div>
          ))}
          <p className="m-0 text-xs leading-relaxed text-ark-muted">
            For kids, up to {cap} a week from playing. Grown-ups play and climb the board too.
          </p>
        </section>
      ) : null}
    </main>
  );
}

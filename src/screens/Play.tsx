import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, RotateCcw, Smartphone } from 'lucide-react';
// Each game downloads only when it's opened.
const PongPlus = lazy(() => import('../games/PongPlus').then((m) => ({ default: m.PongPlus })));
const Breakout = lazy(() => import('../games/Breakout').then((m) => ({ default: m.Breakout })));
const SpaceInvaders = lazy(() => import('../games/SpaceInvaders').then((m) => ({ default: m.SpaceInvaders })));
const Tetris = lazy(() => import('../games/Tetris').then((m) => ({ default: m.Tetris })));
import { useGamepad } from '../services/gamepad';
import { onGameFinish, type GameFinish } from '../services/storage';
import { arkApi, ArkError, type ArkPlayer, type ScoreResult } from '../lib/api';
import { GAME_INFO, formatScore, gameFromPrototypeId, type GameKey } from '../lib/games';
import { go } from '../lib/route';
import { Avatar, BackLink, BucksCoin } from './ui';

type Finish =
  | { state: 'saving'; score: number }
  | { state: 'done'; score: number; result: ScoreResult }
  | { state: 'error'; score: number; message: string; retry: () => void };

export function Play({
  game,
  player,
  settings,
  onPickPlayer,
  onScoreSaved,
}: {
  game: GameKey;
  player: ArkPlayer;
  settings: { bucksEnabled: boolean; weeklyCap: number };
  onPickPlayer: () => void;
  onScoreSaved: () => void;
}) {
  const { player1, player2 } = useGamepad();
  const [run, setRun] = useState(0);
  const [finish, setFinish] = useState<Finish | null>(null);
  const startedAt = useRef(Date.now());
  const lastFinish = useRef(0);
  const playerRef = useRef(player);
  playerRef.current = player;

  useEffect(() => {
    try {
      localStorage.setItem('awc.ark.lastGame', game);
    } catch {
      /* ignore */
    }
  }, [game]);

  useEffect(() => {
    startedAt.current = Date.now();
    return onGameFinish((f: GameFinish) => {
      const key = gameFromPrototypeId(String(f.gameId));
      if (key !== game || f.twoPlayer) return; // 2 players on one screen aren't ranked
      const nowMs = Date.now();
      if (nowMs - lastFinish.current < 1500) return; // one game, one score
      lastFinish.current = nowMs;
      const score = Math.max(0, Math.floor(Number(f.score) || 0));
      const durationSec = Math.round((nowMs - startedAt.current) / 1000);
      startedAt.current = nowMs;
      const stats: Record<string, number> = {};
      if (f.levelReached != null) stats.level = Math.floor(Number(f.levelReached) || 0);
      for (const [k, v] of Object.entries(f.stats || {})) if (typeof v === 'number') stats[k] = Math.floor(v);

      const send = async () => {
        setFinish({ state: 'saving', score });
        try {
          const result = await arkApi.submit({ playerId: playerRef.current.id, game, score, durationSec, stats });
          setFinish({ state: 'done', score, result });
          onScoreSaved();
        } catch (err) {
          setFinish({
            state: 'error',
            score,
            message: err instanceof ArkError ? err.message : 'We couldn’t save that score.',
            retry: () => void send(),
          });
        }
      };
      void send();
    });
  }, [game, run, onScoreSaved]);

  const playAgain = () => {
    setFinish(null);
    setRun((n) => n + 1);
  };

  const canvasGame = game !== 'tetris';

  return (
    <main className="mx-auto w-full max-w-[900px] px-3 sm:px-5 pt-4 pb-8 flex flex-col gap-3">
      <header className="flex items-center gap-3">
        <BackLink href="#/" label="Back to the Ark" />
        <h1 className="m-0 flex-1 font-arcade text-[13px] text-ark-gold truncate">{GAME_INFO[game].title.toUpperCase()}</h1>
        <button
          type="button"
          onClick={onPickPlayer}
          aria-label={`Playing as ${player.name}. Change player`}
          className="flex items-center gap-1.5 rounded-full bg-ark-panel border border-ark-line pl-1 pr-2.5 h-11"
        >
          <Avatar name={player.name} initials={player.initials} url={player.avatarUrl} size={34} highlight />
          <ChevronDown className="w-4 h-4 text-ark-gold" aria-hidden="true" />
        </button>
      </header>

      {canvasGame ? (
        <p className="sm:hidden m-0 flex items-center gap-2 text-xs text-ark-muted portrait:flex landscape:hidden">
          <Smartphone className="w-4 h-4 rotate-90 text-ark-teal" aria-hidden="true" />
          Turn your phone sideways for a bigger screen.
        </p>
      ) : null}

      <div className="w-full">
        <Suspense fallback={<div className="py-16 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-ark-gold" aria-label="Loading game" /></div>}>
        {game === 'pong' && <PongPlus key={run} player1Gamepad={player1} player2Gamepad={player2} />}
        {game === 'breakout' && <Breakout key={run} player1Gamepad={player1} />}
        {game === 'invaders' && <SpaceInvaders key={run} player1Gamepad={player1} />}
        {game === 'tetris' && <Tetris key={run} player1Gamepad={player1} />}
        </Suspense>
      </div>

      {game === 'pong' ? (
        <p className="m-0 text-xs text-ark-muted">2-player games on one screen are just for fun and don’t go on the board.</p>
      ) : null}

      {finish ? (
        <FinishSheet
          finish={finish}
          game={game}
          player={player}
          bucksEnabled={settings.bucksEnabled}
          onPlayAgain={playAgain}
          onClose={() => setFinish(null)}
        />
      ) : null}
    </main>
  );
}

function FinishSheet({
  finish,
  game,
  player,
  bucksEnabled,
  onPlayAgain,
  onClose,
}: {
  finish: Finish;
  game: GameKey;
  player: ArkPlayer;
  bucksEnabled: boolean;
  onPlayAgain: () => void;
  onClose: () => void;
}) {
  const result = finish.state === 'done' ? finish.result : null;
  const gained = result?.bucks.reduce((n, b) => n + b.amount, 0) || 0;
  const held = result?.status === 'held';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="finish-title">
      <div className="w-full max-w-[460px] max-h-[92dvh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-ark-night border border-ark-line px-5 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-5">
        <div className="text-center flex flex-col items-center gap-2.5">
          <p className="m-0 font-arcade text-[11px] text-ark-teal">GAME OVER</p>
          <h2 id="finish-title" className="m-0 font-arcade text-xl leading-normal text-ark-gold">
            {result?.newBest ? 'NEW BEST!' : held ? 'WOW!' : 'NICE GAME'}
          </h2>
          <p className="m-0 font-arcade text-[26px] tabular-nums">{formatScore(finish.score)}</p>
          <p className="m-0 text-sm text-ark-muted">
            {GAME_INFO[game].title} · {player.self ? 'you' : player.name}
            {result?.newBest && result.previousBest != null ? ` · beat ${formatScore(result.previousBest)}` : ''}
          </p>
        </div>

        {finish.state === 'saving' ? (
          <p className="m-0 flex items-center justify-center gap-2 text-sm text-ark-muted" role="status">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Saving to the board…
          </p>
        ) : null}

        {finish.state === 'error' ? (
          <div className="rounded-2xl bg-ark-panel border border-ark-line p-4 flex flex-col gap-3" role="alert">
            <p className="m-0 text-sm">{finish.message}</p>
            <button type="button" onClick={finish.retry} className="h-11 rounded-xl bg-ark-raised font-bold text-sm inline-flex items-center justify-center gap-2">
              <RotateCcw className="w-4 h-4" aria-hidden="true" /> Try again
            </button>
          </div>
        ) : null}

        {result && held ? (
          <div className="rounded-2xl bg-ark-panel border border-ark-line p-4 text-sm leading-relaxed">
            That’s a big jump! A church leader will take a quick look before it goes on the board.
          </div>
        ) : null}

        {result && gained > 0 ? (
          <div className="rounded-[20px] bg-ark-panel border-[1.5px] border-ark-gold p-4 flex items-center gap-3.5">
            <BucksCoin size={56} />
            <div>
              <p className="m-0 text-[22px] font-extrabold text-ark-gold">+{gained} AWC Bucks</p>
              <p className="m-0 mt-1 text-[13px] text-ark-muted">
                {result.bucks.map((b) => b.label).join(' · ')}
                {result.bucksThisWeek != null ? ` · ${result.bucksThisWeek} of ${result.weeklyCap} this week` : ''}
              </p>
            </div>
          </div>
        ) : null}

        {result && !held && gained === 0 && player.isChild && bucksEnabled && result.capped ? (
          <p className="m-0 rounded-2xl bg-ark-panel border border-ark-line p-4 text-sm leading-relaxed">
            You’ve earned all your Ark Bucks for this week. Keep playing for the top 3!
          </p>
        ) : null}

        {result && !held && result.weekRank ? (
          <div className="rounded-[20px] bg-ark-panel border border-ark-line p-4">
            <p className="m-0 text-[12px] font-bold tracking-[0.12em] text-ark-muted">THIS WEEK</p>
            <p className="m-0 mt-1.5 text-lg font-extrabold">
              {player.self ? 'You’re' : `${player.name} is`} #{result.weekRank} in {GAME_INFO[game].title}
            </p>
            {player.isChild && bucksEnabled && result.weekRank <= 3 ? (
              <p className="m-0 mt-1 text-[13px] text-ark-muted">Stay in the top 3 until Sunday night for more Bucks.</p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2.5">
          <button type="button" onClick={onPlayAgain} className="h-14 rounded-2xl bg-ark-gold text-ark-wine font-extrabold text-[17px]">
            Play again
          </button>
          <button
            type="button"
            onClick={() => go(`/board/${game}`)}
            className="h-[52px] rounded-2xl border border-ark-line font-bold text-[15px]"
          >
            See Ark Champions
          </button>
          <button type="button" onClick={onClose} className="h-11 text-ark-muted font-semibold text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

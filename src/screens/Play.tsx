import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Gamepad2, Loader2, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
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
import { PAD_LAYOUTS, PAD_PREF_KEY, shouldShowPad } from '../services/touchPad';
import { TouchPadBar, TouchPadButtons, TouchPadControls } from './TouchPad';
import { loadTier, saveTier, TIER_INFO, TIERS, type Tier } from '../lib/tiers';

function useMedia(query: string): boolean {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;
  const [match, setMatch] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [query]);
  return match;
}

function useViewport() {
  const read = () => ({ w: window.innerWidth, h: window.innerHeight });
  const [vp, setVp] = useState(read);
  useEffect(() => {
    const on = () => setVp(read());
    window.addEventListener('resize', on);
    window.visualViewport?.addEventListener('resize', on);
    return () => {
      window.removeEventListener('resize', on);
      window.visualViewport?.removeEventListener('resize', on);
    };
  }, []);
  return vp;
}

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
  // Skill tier, remembered per player.
  const [tier, setTier] = useState<Tier>(() => loadTier(player.id));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const tierRef = useRef(tier);
  tierRef.current = tier;
  useEffect(() => {
    setTier(loadTier(player.id));
  }, [player.id]);
  const chooseTier = (next: Tier) => {
    setSettingsOpen(false);
    if (next === tier) return;
    saveTier(player.id, next);
    setTier(next);
    setFinish(null);
    setRun((n) => n + 1); // a new game at the new level
  };
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
      // Tier first: the board keeps up to 8 stats. 1 Beginner, 2 Intermediate, 3 Advanced.
      const stats: Record<string, number> = { tier: TIER_INFO[tierRef.current].code };
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

  // On-screen pad: on by default for touch screens, off for mouse + keyboard.
  // Anyone can switch it with the button in the header, and we remember.
  const touchScreen = useMedia('(any-pointer: coarse)');
  const [padPref, setPadPref] = useState<string | null>(() => {
    try {
      return localStorage.getItem(PAD_PREF_KEY);
    } catch {
      return null;
    }
  });
  const padOn = shouldShowPad(padPref, touchScreen);
  const togglePad = () => {
    const next = padOn ? 'off' : 'on';
    setPadPref(next);
    try {
      localStorage.setItem(PAD_PREF_KEY, next);
    } catch {
      /* private mode */
    }
  };

  // Phone sideways (short screen): pad goes beside the game instead of under it,
  // so the game keeps the full height.
  const sideways = useMedia('(orientation: landscape) and (max-height: 560px)');
  const { w: vw, h: vh } = useViewport();
  const layout = PAD_LAYOUTS[game];
  const padBeside = padOn && sideways;
  // Left/right games use a wide rocker (1.35x as wide as tall-ish), so size it to fit.
  const wideRocker = layout.directions.length === 2 && layout.directions.includes('left');
  const dpadSize = Math.round(
    padBeside
      ? Math.min(wideRocker ? 128 : 150, vh * 0.44)
      : Math.min(156, vw * (wideRocker ? 0.32 : 0.4), vh * 0.2)
  );
  const padBase = Math.round(padBeside ? Math.min(150, vh * 0.44) : Math.min(156, vw * 0.4, vh * 0.2));
  const buttonSize = Math.round(padBase * (layout.buttons.length > 1 ? 0.44 : 0.5));

  const sideWidth = Math.max(wideRocker ? Math.round(dpadSize * 1.35) : dpadSize, buttonSize * 2 + 24, 112) + 8;

  const settingsButton = (
    <button
      type="button"
      onClick={() => setSettingsOpen(true)}
      aria-label={`Level: ${TIER_INFO[tier].label}. Change level`}
      title="Game settings"
      className="shrink-0 flex items-center gap-1.5 h-11 rounded-full border bg-ark-panel text-ark-gold border-ark-line px-3"
    >
      <SlidersHorizontal className="w-5 h-5" aria-hidden="true" />
      <span className="ark-hide-compact hidden min-[420px]:inline text-[13px] font-bold">{TIER_INFO[tier].label}</span>
    </button>
  );

  const padToggle = (
    <button
      type="button"
      onClick={togglePad}
      aria-pressed={padOn}
      aria-label={padOn ? 'Hide on-screen controls' : 'Show on-screen controls'}
      title={padOn ? 'Hide on-screen controls' : 'Show on-screen controls'}
      className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-full border ${
        padOn ? 'bg-ark-gold text-white border-ark-gold' : 'bg-ark-panel text-ark-gold border-ark-line'
      }`}
    >
      <Gamepad2 className="w-5 h-5" aria-hidden="true" />
    </button>
  );

  const playerButton = (
    <button
      type="button"
      onClick={onPickPlayer}
      aria-label={`Playing as ${player.name}. Change player`}
      className="shrink-0 flex items-center gap-1.5 rounded-full bg-ark-panel border border-ark-line pl-1 pr-2.5 h-11"
    >
      <Avatar name={player.name} initials={player.initials} url={player.avatarUrl} size={34} highlight />
      <ChevronDown className="w-4 h-4 text-ark-gold" aria-hidden="true" />
    </button>
  );

  return (
    <main
      className={`ark-fit mx-auto w-full overflow-hidden flex flex-col ${sideways ? 'ark-compact' : ''} ${padBeside ? 'gap-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] max-w-none' : 'gap-2 sm:gap-3 pt-3 sm:pt-4 px-3 sm:px-5 max-w-[900px]'} pb-[max(0.5rem,env(safe-area-inset-bottom))]`}
      data-pad={padOn ? (padBeside ? 'beside' : 'below') : 'off'}
    >
      {padBeside ? null : (
        <header className="shrink-0 flex items-center gap-3">
          <BackLink href="#/" label="Back to the Ark" />
          <h1 className="m-0 flex-1 font-arcade text-[13px] text-ark-gold truncate">{GAME_INFO[game].title.toUpperCase()}</h1>
          {settingsButton}
          {padToggle}
          {playerButton}
        </header>
      )}

      {/* Game fills whatever height is left; the pad sits under it, or beside it when sideways. */}
      <div className="flex-1 min-h-0 flex items-stretch gap-3">
        {padBeside ? (
          <div className="shrink-0 flex flex-col items-center gap-4" style={{ width: sideWidth }} data-touch-pad="left">
            <div className="w-full flex items-center gap-2">
              <BackLink href="#/" label="Back to the Ark" />
              <h1 className="sr-only">{GAME_INFO[game].title}</h1>
            </div>
            {/* Gap above keeps a thumb near the top of the steering area off the Back button. */}
            <div className="flex-1 w-full min-h-0 pt-2">
              <TouchPadControls layout={layout} size={dpadSize} />
            </div>
          </div>
        ) : null}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-ark-gold" aria-label="Loading game" /></div>}>
          {game === 'pong' && <PongPlus key={`${run}-${tier}`} tier={tier} player1Gamepad={player1} player2Gamepad={player2} compact={sideways || padOn} />}
          {game === 'breakout' && <Breakout key={`${run}-${tier}`} tier={tier} player1Gamepad={player1} />}
          {game === 'invaders' && <SpaceInvaders key={`${run}-${tier}`} tier={tier} player1Gamepad={player1} />}
          {game === 'tetris' && <Tetris key={`${run}-${tier}`} tier={tier} player1Gamepad={player1} />}
          </Suspense>
        </div>
        {padBeside ? (
          <div className="shrink-0 flex flex-col items-center gap-4" style={{ width: sideWidth }} data-touch-pad="right">
            <div className="w-full flex items-center justify-end gap-2">
              {settingsButton}
          {padToggle}
              {playerButton}
            </div>
            <div className="flex-1 flex items-center">
              <TouchPadButtons layout={layout} size={buttonSize} />
            </div>
          </div>
        ) : null}
      </div>

      {padOn && !padBeside ? <TouchPadBar layout={layout} dpadSize={dpadSize} buttonSize={buttonSize} /> : null}

      {game === 'pong' && !sideways ? (
        <p className="shrink-0 m-0 text-xs text-ark-muted">2-player games on one screen are just for fun and don’t go on the board.</p>
      ) : null}

      {settingsOpen ? <TierSheet tier={tier} onPick={chooseTier} onClose={() => setSettingsOpen(false)} /> : null}

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

function TierSheet({ tier, onPick, onClose }: { tier: Tier; onPick: (t: Tier) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tier-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] max-h-[92dvh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-ark-night border border-ark-line px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-0 font-arcade text-[11px] text-ark-teal">SETTINGS</p>
            <h2 id="tier-title" className="m-0 mt-2 text-xl font-extrabold">Choose your level</h2>
            <p className="m-0 mt-1 text-sm text-ark-muted">Applies to every game. Changing it starts a new game.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 w-11 h-11 rounded-full bg-ark-panel border border-ark-line flex items-center justify-center">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Level">
          {TIERS.map((t, i) => {
            const on = t === tier;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onPick(t)}
                className={`text-left rounded-2xl border-[1.5px] px-4 py-3.5 flex items-center gap-3.5 ${
                  on ? 'border-ark-gold bg-ark-raised' : 'border-ark-line bg-ark-panel'
                }`}
              >
                <span className="shrink-0 flex items-end gap-[3px] h-6" aria-hidden="true">
                  {[0, 1, 2].map((b) => (
                    <span key={b} className={`w-[5px] rounded-sm ${b <= i ? 'bg-ark-gold' : 'bg-ark-line'}`} style={{ height: 8 + b * 7 }} />
                  ))}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[16px] font-extrabold">{TIER_INFO[t].label}</span>
                  <span className="block text-[13px] text-ark-muted">{TIER_INFO[t].blurb}</span>
                </span>
                {on ? <Check className="shrink-0 w-5 h-5 text-ark-gold" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Pause, Play } from 'lucide-react';
import type { Tier } from '../lib/tiers';
import { storage } from '../services/storage';
import type { GamepadState } from '../types';
import { COLUMNS, ROWS, directions, newSnakeRun, readSnakeController, stepSnake, type Direction, type SnakeRun } from './neonSnakeLogic';

const CELL = 24;
const KEYS: Partial<Record<string, Direction>> = {
  ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down',
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
};
const SPEED: Record<Tier, number> = { beginner: 1.25, intermediate: 1, advanced: 0.8 };
type Phase = 'ready' | 'playing' | 'paused' | 'ended';

function draw(context: CanvasRenderingContext2D, run: SnakeRun) {
  const { width, height } = context.canvas;
  context.fillStyle = '#08151b';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = '#173138';
  context.beginPath();
  for (let x = CELL; x < width; x += CELL) {
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, height);
  }
  for (let y = CELL; y < height; y += CELL) {
    context.moveTo(0, y + 0.5);
    context.lineTo(width, y + 0.5);
  }
  context.stroke();

  if (run.food) {
    context.save();
    context.shadowColor = '#ff5b9c';
    context.shadowBlur = 16;
    context.fillStyle = '#ff82b3';
    context.beginPath();
    context.arc((run.food.x + 0.5) * CELL, (run.food.y + 0.5) * CELL, CELL * 0.28, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  for (const [index, segment] of run.body.entries()) {
    context.fillStyle = index ? '#54f5d2' : '#c4ff7c';
    context.beginPath();
    context.roundRect(segment.x * CELL + 2, segment.y * CELL + 2, CELL - 4, CELL - 4, 5);
    context.fill();
  }
  const head = run.body[0];
  const direction = directions[run.direction];
  context.fillStyle = '#142016';
  for (const side of [-1, 1]) {
    context.beginPath();
    context.arc(
      (head.x + 0.5) * CELL + direction.x * 4 - direction.y * side * 4,
      (head.y + 0.5) * CELL + direction.y * 4 + direction.x * side * 4,
      1.5, 0, Math.PI * 2,
    );
    context.fill();
  }
}

export function NeonSnake({ tier, player1Gamepad, onRestart }: { tier: Tier; player1Gamepad: GamepadState | null; onRestart: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pad = useRef(player1Gamepad);
  pad.current = player1Gamepad;
  const initialAction = useRef<() => void>(() => {});
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const turn = useRef<(direction: Direction) => void>(() => {});
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    let run = newSnakeRun();
    let currentPhase: Phase = 'ready';
    let next: Direction | null = null;
    let lastFrame: number | null = null;
    let accumulator = 0;
    let activeMs = 0;
    let previousPad: Direction | null = null;
    let previousButton = false;
    let frameId = 0;
    draw(context, run);

    const changePhase = (value: Phase) => {
      currentPhase = value;
      lastFrame = null;
      setPhase(value);
      if (value === 'playing') canvas.current?.focus({ preventScroll: true });
    };
    const startPause = () => {
      if (currentPhase === 'ended') return;
      changePhase(currentPhase === 'playing' ? 'paused' : 'playing');
    };
    const acceptTurn = (direction: Direction) => {
      if (currentPhase === 'ready') changePhase('playing');
      if (currentPhase !== 'playing' || next || direction === run.direction) return;
      const old = directions[run.direction];
      const candidate = directions[direction];
      if (old.x + candidate.x === 0 && old.y + candidate.y === 0) return;
      next = direction;
    };
    initialAction.current = startPause;
    turn.current = acceptTurn;
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      if (event.target instanceof HTMLElement && event.target.closest('button,input,select,textarea,[contenteditable]')) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const candidate = KEYS[key];
      if (candidate) {
        event.preventDefault();
        acceptTurn(candidate);
      } else if (key === ' ' || key === 'p') {
        event.preventDefault();
        startPause();
      }
    };
    const onBlur = () => { if (currentPhase === 'playing') changePhase('paused'); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);

    const frame = (time: number) => {
      const { direction: padDirection, action: pressed } = readSnakeController(pad.current);
      if (pressed && !previousButton) startPause();
      else if (padDirection && padDirection !== previousPad) acceptTurn(padDirection);
      previousPad = padDirection;
      previousButton = pressed;

      if (currentPhase === 'playing' && lastFrame !== null) {
        const delta = Math.min(time - lastFrame, 100);
        accumulator += delta;
        activeMs += delta;
        const delay = Math.max(72, 155 - Math.floor(run.score / 5) * 9) * SPEED[tier];
        if (accumulator >= delay) {
          accumulator -= delay;
          const updated = stepSnake(run, next ?? run.direction);
          if (updated.score !== run.score) setScore(updated.score);
          run = updated;
          next = null;
          draw(context, run);
          if (run.ended) {
            changePhase('ended');
            storage.addHighScore({ gameId: 'neon-snake', score: run.score, durationSec: Math.floor(activeMs / 1000) });
            return;
          }
        }
      }
      lastFrame = currentPhase === 'playing' ? time : null;
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
      initialAction.current = () => {};
      turn.current = () => {};
    };
  }, [tier]);

  function steer(event: PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType !== 'touch' || !swipe.current) return;
    const x = event.clientX - swipe.current.x;
    const y = event.clientY - swipe.current.y;
    if (Math.max(Math.abs(x), Math.abs(y)) < 15) return;
    swipe.current = { x: event.clientX, y: event.clientY };
    turn.current(Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up'));
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col items-center gap-2" aria-label="Neon Snake">
      <div className="flex w-full max-w-xl items-center justify-between px-1 text-sm">
        <p className="m-0 font-semibold text-ark-muted">Score <span className="ml-2 font-arcade text-[#c4ff7c]">{String(score).padStart(3, '0')}</span></p>
        {phase === 'playing' && <button type="button" onClick={() => initialAction.current()} className="flex items-center gap-2 rounded-xl border border-ark-line bg-ark-panel px-3 py-2 font-semibold"><Pause size={15} /> Pause</button>}
      </div>
      <div className="relative flex min-h-0 w-full max-w-xl flex-1 items-center justify-center">
        <canvas ref={canvas} width={COLUMNS * CELL} height={ROWS * CELL} aria-label="Neon Snake game board" tabIndex={-1}
          className="h-auto max-h-full w-auto max-w-full touch-none rounded-xl border border-[#29504b] object-contain"
          onPointerDown={(event) => {
            if (event.pointerType !== 'touch') return;
            event.currentTarget.setPointerCapture(event.pointerId);
            swipe.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerMove={steer}
          onPointerUp={() => { swipe.current = null; }}
          onPointerCancel={() => { swipe.current = null; }} />
        {phase !== 'playing' && (
          <div className="absolute mx-3 max-w-xs rounded-2xl border border-[#37605a] bg-[#0b1b23]/95 p-4 text-center shadow-xl sm:p-6">
            <h2 className="m-0 font-arcade text-sm text-[#c4ff7c] sm:text-lg">{phase === 'paused' ? 'Paused' : phase === 'ended' ? 'Run complete' : 'Neon Snake'}</h2>
            {phase === 'ready' && <p className="mb-0 mt-3 text-sm text-ark-muted">Collect the pink orbs. Watch out for walls and your tail.</p>}
            <button type="button" onClick={() => phase === 'ended' ? onRestart() : initialAction.current()} className="mx-auto mt-4 flex min-h-10 items-center gap-2 rounded-xl bg-[#54f5d2] px-4 font-bold text-[#08151b]">
              <Play size={15} /> {phase === 'paused' ? 'Resume' : phase === 'ended' ? 'Play again' : 'Start game'}
            </button>
          </div>
        )}
      </div>
      <p className="m-0 text-center text-xs text-ark-muted">Steer with arrows, WASD, or swipe. Space or A starts, pauses, or resumes.</p>
    </section>
  );
}

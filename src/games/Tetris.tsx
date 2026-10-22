import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TIER_TUNING, type Tier } from '../lib/tiers';
import confetti from 'canvas-confetti';
import { GamepadState, HighScoreEntry, ScoreSubmissionData } from '../types';
import { sound } from '../services/sound';
import { storage } from '../services/storage';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Trophy } from 'lucide-react';

interface TetrisProps {
  /** Beginner / Intermediate / Advanced. */
  tier?: Tier;
  player1Gamepad: GamepadState | null;
  onScoreSaved?: (entry: HighScoreEntry) => void;
  onAchievementUnlocked?: (title: string, xp: number) => void;
}

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 24;

const TETROMINOES = {
  I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#06b6d4' },
  O: { shape: [[1,1],[1,1]], color: '#eab308' },
  T: { shape: [[0,1,0],[1,1,1],[0,0,0]], color: '#a855f7' },
  S: { shape: [[0,1,1],[1,1,0],[0,0,0]], color: '#22c55e' },
  Z: { shape: [[1,1,0],[0,1,1],[0,0,0]], color: '#ef4444' },
  J: { shape: [[1,0,0],[1,1,1],[0,0,0]], color: '#3b82f6' },
  L: { shape: [[0,0,1],[1,1,1],[0,0,0]], color: '#f97316' },
};

type TetrominoKey = keyof typeof TETROMINOES;

export const Tetris: React.FC<TetrisProps> = ({
  player1Gamepad,
  tier = 'intermediate',
  onScoreSaved,
  onAchievementUnlocked,
}) => {
  const tune = TIER_TUNING[tier];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /** Board gestures: tap = rotate, sideways = move, down = drop. */
  const swipeRef = useRef<{ x: number; y: number; moved: number } | null>(null);

  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [nextPiece, setNextPiece] = useState<TetrominoKey>('T');
  const [holdPiece, setHoldPiece] = useState<TetrominoKey | null>(null);
  const [canHold, setCanHold] = useState(true);
  const [isMuted, setIsMuted] = useState(sound.getMuted());

  const gridRef = useRef<string[][]>(
    Array.from({ length: ROWS }, () => Array(COLS).fill(''))
  );
  const currentPieceRef = useRef<{
    shape: number[][];
    color: string;
    key: TetrominoKey;
    x: number;
    y: number;
  }>({
    shape: TETROMINOES.T.shape,
    color: TETROMINOES.T.color,
    key: 'T',
    x: 3,
    y: 0,
  });

  const dropCounterRef = useRef(0);
  const lastTimeRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const lastGamepadInputRef = useRef<{ [key: string]: number }>({});

  const getRandomPiece = useCallback((): TetrominoKey => {
    const keys = Object.keys(TETROMINOES) as TetrominoKey[];
    return keys[Math.floor(Math.random() * keys.length)];
  }, []);

  const collide = useCallback((piece: { shape: number[][]; x: number; y: number }, grid: string[][]) => {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c] !== 0) {
          const newX = piece.x + c;
          const newY = piece.y + r;
          if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
          if (newY >= 0 && grid[newY][newX] !== '') return true;
        }
      }
    }
    return false;
  }, []);

  const rotateMatrix = (matrix: number[][]) => {
    return matrix[0].map((_, index) => matrix.map(row => row[index]).reverse());
  };

  const spawnPiece = useCallback((key?: TetrominoKey) => {
    const pKey = key || nextPiece;
    const shape = TETROMINOES[pKey].shape.map(row => [...row]);
    currentPieceRef.current = {
      shape,
      color: TETROMINOES[pKey].color,
      key: pKey,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
    setNextPiece(getRandomPiece());
    setCanHold(true);

    if (collide(currentPieceRef.current, gridRef.current)) {
      setGameOver(true);
      setIsPlaying(false);
      sound.playGameOver();

      const entry = storage.addHighScore({
        gameId: 'tetris',
        playerName: 'AWC Matrix',
        avatar: '🕹️',
        score: score,
        levelReached: level,
        device: player1Gamepad?.connected ? 'Gamepad' : 'Keyboard',
      });
      if (onScoreSaved) onScoreSaved(entry);
    }
  }, [nextPiece, getRandomPiece, collide, score, level, player1Gamepad, onScoreSaved]);

  const mergePiece = useCallback(() => {
    const p = currentPieceRef.current;
    const grid = gridRef.current;

    for (let r = 0; r < p.shape.length; r++) {
      for (let c = 0; c < p.shape[r].length; c++) {
        if (p.shape[r][c] !== 0 && p.y + r >= 0) {
          grid[p.y + r][p.x + c] = p.color;
        }
      }
    }

    // Check line clears
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r].every(cell => cell !== '')) {
        grid.splice(r, 1);
        grid.unshift(Array(COLS).fill(''));
        cleared++;
        r++;
      }
    }

    if (cleared > 0) {
      sound.playLineClear();
      const points = [0, 100, 300, 500, 800][cleared] * level;
      setScore(s => {
        const next = s + points;
        if (next >= 50000) {
          const ach = storage.updateAchievementProgress('tetris_50k', next);
          if (ach && onAchievementUnlocked) onAchievementUnlocked(ach.title, ach.xp);
        }
        return next;
      });
      setLines(l => {
        const total = l + cleared;
        setLevel(Math.floor(total / 10) + 1);
        return total;
      });

      if (cleared === 4) {
        confetti({ particleCount: 70, spread: 50 });
        const ach = storage.unlockAchievement('tetris_quad');
        if (ach && onAchievementUnlocked) onAchievementUnlocked(ach.title, ach.xp);
      }
    } else {
      sound.playPaddleHit(280);
    }

    spawnPiece();
  }, [level, spawnPiece, onAchievementUnlocked]);

  const moveHoriz = useCallback((dir: number) => {
    if (!isPlaying || isPaused) return;
    const p = currentPieceRef.current;
    p.x += dir;
    if (collide(p, gridRef.current)) {
      p.x -= dir;
    } else {
      sound.playClick();
    }
  }, [isPlaying, isPaused, collide]);

  const rotatePiece = useCallback(() => {
    if (!isPlaying || isPaused) return;
    const p = currentPieceRef.current;
    const rotated = rotateMatrix(p.shape);
    const oldShape = p.shape;
    p.shape = rotated;
    if (collide(p, gridRef.current)) {
      // Wall kick attempt
      p.x += 1;
      if (collide(p, gridRef.current)) {
        p.x -= 2;
        if (collide(p, gridRef.current)) {
          p.x += 1;
          p.shape = oldShape;
          return;
        }
      }
    }
    sound.playClick();
  }, [isPlaying, isPaused, collide]);

  const dropOne = useCallback(() => {
    if (!isPlaying || isPaused) return;
    const p = currentPieceRef.current;
    p.y += 1;
    if (collide(p, gridRef.current)) {
      p.y -= 1;
      mergePiece();
    }
  }, [isPlaying, isPaused, collide, mergePiece]);

  const hardDrop = useCallback(() => {
    if (!isPlaying || isPaused) return;
    const p = currentPieceRef.current;
    while (!collide(p, gridRef.current)) {
      p.y += 1;
    }
    p.y -= 1;
    mergePiece();
  }, [isPlaying, isPaused, collide, mergePiece]);

  const holdCurrentPiece = useCallback(() => {
    if (!isPlaying || isPaused || !canHold) return;
    const currentKey = currentPieceRef.current.key;
    if (!holdPiece) {
      setHoldPiece(currentKey);
      spawnPiece();
    } else {
      const nextToSpawn = holdPiece;
      setHoldPiece(currentKey);
      spawnPiece(nextToSpawn);
    }
    setCanHold(false);
    sound.playClick();
  }, [isPlaying, isPaused, canHold, holdPiece, spawnPiece]);

  const startGame = useCallback(() => {
    gridRef.current = Array.from({ length: ROWS }, () => Array(COLS).fill(''));
    setScore(0);
    setLines(0);
    setLevel(1);
    setHoldPiece(null);
    setGameOver(false);
    setIsPlaying(true);
    setIsPaused(false);
    spawnPiece(getRandomPiece());
    sound.playScore();
  }, [getRandomPiece, spawnPiece]);

  // Space (or the on-screen A button) starts the game from the start screen.
  useEffect(() => {
    if (isPlaying) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      e.preventDefault();
      startGame();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPlaying, startGame]);

  // Keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyLower = e.key.toLowerCase();
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) ||
        ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(keyLower)
      ) {
        e.preventDefault();
      }
      keysRef.current[e.key] = true;
      if (e.key === 'ArrowLeft' || e.key === 'a') moveHoriz(-1);
      if (e.key === 'ArrowRight' || e.key === 'd') moveHoriz(1);
      if (e.key === 'ArrowUp' || e.key === 'w') rotatePiece();
      if (e.key === 'ArrowDown' || e.key === 's') dropOne();
      if (e.key === ' ') hardDrop();
      if (e.key === 'c' || e.key === 'Shift') holdCurrentPiece();
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveHoriz, rotatePiece, dropOne, hardDrop, holdCurrentPiece]);

  // Gamepad Polling
  useEffect(() => {
    if (!player1Gamepad?.connected || !isPlaying || isPaused) return;

    const now = Date.now();
    const last = lastGamepadInputRef.current;
    const throttle = (key: string, ms: number) => {
      if (!last[key] || now - last[key] > ms) {
        last[key] = now;
        return true;
      }
      return false;
    };

    if (player1Gamepad.buttons.left && throttle('left', 140)) moveHoriz(-1);
    if (player1Gamepad.buttons.right && throttle('right', 140)) moveHoriz(1);
    if (player1Gamepad.buttons.up && throttle('up', 250)) hardDrop();
    if (player1Gamepad.buttons.down && throttle('down', 100)) dropOne();
    if (player1Gamepad.buttons.a && throttle('a', 200)) rotatePiece();
    if (player1Gamepad.buttons.y && throttle('y', 250)) holdCurrentPiece();
  }, [player1Gamepad, isPlaying, isPaused, moveHoriz, hardDrop, dropOne, rotatePiece, holdCurrentPiece]);

  // Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = (time: number) => {
      const dt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      if (isPlaying && !isPaused) {
        dropCounterRef.current += dt;
        const dropInterval = Math.max(0.12, 0.8 - (level - 1) * 0.07) * tune.dropTime;
        if (dropCounterRef.current > dropInterval) {
          dropCounterRef.current = 0;
          dropOne();
        }
      }

      // Drawing
      ctx.fillStyle = '#05070f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid background
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          ctx.strokeRect(c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
      }

      // Draw Grid Blocks
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const color = gridRef.current[r][c];
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(c * BLOCK_SIZE + 1, r * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
            ctx.fillStyle = '#ffffff40';
            ctx.fillRect(c * BLOCK_SIZE + 2, r * BLOCK_SIZE + 2, 4, 4);
          }
        }
      }

      // Draw Ghost Piece
      if (isPlaying && !isPaused) {
        const p = currentPieceRef.current;
        let ghostY = p.y;
        while (!collide({ shape: p.shape, x: p.x, y: ghostY + 1 }, gridRef.current)) {
          ghostY++;
        }
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        for (let r = 0; r < p.shape.length; r++) {
          for (let c = 0; c < p.shape[r].length; c++) {
            if (p.shape[r][c] !== 0) {
              ctx.strokeRect((p.x + c) * BLOCK_SIZE + 2, (ghostY + r) * BLOCK_SIZE + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
            }
          }
        }

        // Draw Active Piece
        ctx.fillStyle = p.color;
        for (let r = 0; r < p.shape.length; r++) {
          for (let c = 0; c < p.shape[r].length; c++) {
            if (p.shape[r][c] !== 0) {
              ctx.fillRect((p.x + c) * BLOCK_SIZE + 1, (p.y + r) * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
              ctx.fillStyle = '#ffffff60';
              ctx.fillRect((p.x + c) * BLOCK_SIZE + 2, (p.y + r) * BLOCK_SIZE + 2, 4, 4);
              ctx.fillStyle = p.color;
            }
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, isPaused, level, dropOne, collide]);

  return (
    <div className="flex flex-col gap-2 sm:gap-3 w-full h-full min-h-0">
      {/* Top Header */}
      <div className="ark-game-bar shrink-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-slate-900 border border-slate-800 px-3 py-2 sm:p-3 rounded-xl">
        <div className="flex items-center gap-3">
          <span className="ark-game-title font-arcade text-xs text-purple-400">TETRIS : NEON MATRIX</span>
          <span className="text-xs px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-mono">
            LVL {level}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-slate-400">Score: <strong className="text-purple-400 text-sm">{score}</strong></span>
          <span className="text-slate-400">Lines: <strong className="text-cyan-400">{lines}</strong></span>
        </div>

        <div className="flex items-center gap-2">
          {!isPlaying ? (
            <button
              onClick={startGame}
              className="retro-btn px-4 py-1.5 bg-purple-500 hover:bg-purple-400 text-slate-950 font-arcade text-xs rounded font-bold cursor-pointer"
            >
              DROP IN
            </button>
          ) : (
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="px-3 py-1.5 bg-slate-800 text-slate-200 text-xs rounded cursor-pointer"
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            onClick={startGame}
            className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMuted(sound.toggleMute())}
            className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-purple-400" />}
          </button>
        </div>
      </div>

      {/* Main Board + Sidebar */}
      {/* Board fills the height it's given, so nothing scrolls. */}
      <div className="flex-1 min-h-0 flex flex-row items-stretch justify-center gap-4 sm:gap-6 bg-slate-950 p-2 sm:p-4 rounded-2xl border-2 border-purple-500/30 shadow-2xl crt-overlay">
        {/* Left Mini Panel: HOLD */}
        <div className="hidden sm:flex self-center flex-col items-center bg-slate-900/80 p-3 rounded-xl border border-slate-800 w-28">
          <span className="font-arcade text-[10px] text-slate-400 mb-2">HOLD (C)</span>
          <div className="w-16 h-16 flex items-center justify-center bg-slate-950 rounded border border-slate-800">
            {holdPiece ? (
              <span className="font-arcade text-lg" style={{ color: TETROMINOES[holdPiece].color }}>
                {holdPiece}
              </span>
            ) : (
              <span className="text-slate-600 text-xs font-mono">EMPTY</span>
            )}
          </div>
          <button
            onClick={holdCurrentPiece}
            disabled={!canHold || !isPlaying}
            className="mt-3 px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[10px] rounded text-slate-200 w-full"
          >
            HOLD
          </button>
        </div>

        {/* Matrix Canvas */}
        <div className="relative self-center h-full max-h-[720px] min-h-0 border-4 border-slate-800 rounded bg-slate-950 shadow-inner">
          <canvas
            ref={canvasRef}
            width={COLS * BLOCK_SIZE}
            height={ROWS * BLOCK_SIZE}
            className="block h-full w-auto max-w-none"
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              swipeRef.current = { x: e.clientX, y: e.clientY, moved: 0 };
            }}
            onPointerMove={(e) => {
              const st = swipeRef.current;
              if (!st) return;
              const step = 28;
              const dx = e.clientX - st.x;
              if (Math.abs(dx) >= step) {
                moveHoriz(dx > 0 ? 1 : -1);
                st.x = e.clientX;
                st.moved += 1;
              }
            }}
            onPointerUp={(e) => {
              const st = swipeRef.current;
              swipeRef.current = null;
              if (!st) return;
              const dy = e.clientY - st.y;
              if (dy > 60) hardDrop();
              else if (st.moved === 0 && Math.abs(dy) < 12) rotatePiece();
            }}
            onPointerCancel={() => { swipeRef.current = null; }}
          />

          {gameOver && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center z-20">
              <h2 className="font-arcade text-xl text-red-500 mb-2">MATRIX FULL</h2>
              <p className="text-xs font-mono text-slate-300 mb-4">Final Score: {score}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  onClick={startGame}
                  className="retro-btn px-4 py-2 bg-purple-500 text-slate-950 font-arcade text-xs rounded font-bold cursor-pointer"
                >
                  RESTART
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Mini Panel: NEXT */}
        <div className="hidden sm:flex self-center flex-col items-center bg-slate-900/80 p-3 rounded-xl border border-slate-800 w-28">
          <span className="font-arcade text-[10px] text-slate-400 mb-2">NEXT</span>
          <div className="w-16 h-16 flex items-center justify-center bg-slate-950 rounded border border-slate-800">
            <span className="font-arcade text-lg" style={{ color: TETROMINOES[nextPiece].color }}>
              {nextPiece}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 mt-3 text-center">
            Space: Drop<br />Up: Rotate
          </span>
        </div>

      </div>
    </div>
  );
};

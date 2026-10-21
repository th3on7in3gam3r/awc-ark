import React, { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { GamepadState, HighScoreEntry, ScoreSubmissionData } from '../types';
import { sound } from '../services/sound';
import { storage } from '../services/storage';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Shield, Heart, Trophy } from 'lucide-react';

interface SpaceInvadersProps {
  player1Gamepad: GamepadState | null;
  onScoreSaved?: (entry: HighScoreEntry) => void;
  onAchievementUnlocked?: (title: string, xp: number) => void;
}

interface Alien {
  x: number;
  y: number;
  row: number;
  col: number;
  type: 'squid' | 'crab' | 'octopus';
  points: number;
  alive: boolean;
}

interface BunkerBlock {
  x: number;
  y: number;
  hp: number;
}

export const SpaceInvaders: React.FC<SpaceInvadersProps> = ({
  player1Gamepad,
  onScoreSaved,
  onAchievementUnlocked,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [lives, setLives] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isMuted, setIsMuted] = useState(sound.getMuted());

  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const mobileTouchX = useRef<number | null>(null);

  const playerRef = useRef({ x: 380, y: 450, w: 32, h: 20, speed: 6 });
  const aliensRef = useRef<Alien[]>([]);
  const alienDirRef = useRef<number>(1);
  const alienSpeedRef = useRef<number>(1);
  const playerBulletsRef = useRef<{ x: number; y: number; vy: number }[]>([]);
  const alienBulletsRef = useRef<{ x: number; y: number; vy: number }[]>([]);
  const bunkersRef = useRef<BunkerBlock[]>([]);
  const ufoRef = useRef<{ x: number; y: number; active: boolean; points: number } | null>(null);
  const scoreRef = useRef(0);
  const waveRef = useRef(1);
  const stepTimerRef = useRef(0);

  // Initialize Bunker Shields
  const initBunkers = (width: number) => {
    const bunkers: BunkerBlock[] = [];
    const bunkerCount = 4;
    const spacing = width / (bunkerCount + 1);

    for (let b = 0; b < bunkerCount; b++) {
      const startX = spacing * (b + 1) - 25;
      const startY = 380;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 5; c++) {
          if (r === 2 && (c === 1 || c === 2 || c === 3)) continue; // archway
          bunkers.push({
            x: startX + c * 10,
            y: startY + r * 10,
            hp: 3,
          });
        }
      }
    }
    bunkersRef.current = bunkers;
  };

  // Initialize Aliens
  const initAliens = useCallback((currentWave: number) => {
    const aliens: Alien[] = [];
    const rows = 5;
    const cols = 10;
    const spacingX = 42;
    const spacingY = 32;
    const startX = 60;
    const startY = 60;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const type: Alien['type'] = r === 0 ? 'squid' : r < 3 ? 'crab' : 'octopus';
        const points = r === 0 ? 30 : r < 3 ? 20 : 10;
        aliens.push({
          x: startX + c * spacingX,
          y: startY + r * spacingY,
          row: r,
          col: c,
          type,
          points,
          alive: true,
        });
      }
    }
    aliensRef.current = aliens;
    alienDirRef.current = 1;
    alienSpeedRef.current = 1 + currentWave * 0.25;
  }, []);

  const shootPlayerBullet = useCallback(() => {
    if (!isPlaying || isPaused) return;
    if (playerBulletsRef.current.length < 2) {
      sound.playLaser();
      playerBulletsRef.current.push({
        x: playerRef.current.x + playerRef.current.w / 2,
        y: playerRef.current.y - 6,
        vy: -9,
      });
    }
  }, [isPlaying, isPaused]);

  // Keys & Gamepad
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyLower = e.key.toLowerCase();
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) ||
        ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(keyLower)
      ) {
        e.preventDefault();
      }
      keysPressed.current[keyLower] = true;
      if (e.key === ' ' || e.key === 'arrowup' || e.code === 'ArrowUp' || e.code === 'Space') {
        shootPlayerBullet();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const keyLower = e.key.toLowerCase();
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) ||
        ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(keyLower)
      ) {
        e.preventDefault();
      }
      keysPressed.current[keyLower] = false;
    };
    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [shootPlayerBullet]);

  useEffect(() => {
    if (player1Gamepad?.buttons.a) {
      shootPlayerBullet();
    }
  }, [player1Gamepad?.buttons.a, shootPlayerBullet]);

  // Start game
  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    scoreRef.current = 0;
    waveRef.current = 1;
    setScore(0);
    setWave(1);
    setLives(3);
    setGameOver(false);
    setIsPlaying(true);
    setIsPaused(false);
    playerBulletsRef.current = [];
    alienBulletsRef.current = [];
    ufoRef.current = null;

    initBunkers(canvas.width);
    initAliens(1);
    sound.playScore();
  }, [initAliens]);

  // Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const loop = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = '#05070f';
      ctx.fillRect(0, 0, width, height);

      // Stars
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 30; i++) {
        const sx = ((i * 123 + 45) % width);
        const sy = ((i * 321 + 67) % height);
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      if (isPlaying && !isPaused) {
        // Player move
        let move = 0;
        if (keysPressed.current['arrowleft'] || keysPressed.current['a']) move -= 1;
        if (keysPressed.current['arrowright'] || keysPressed.current['d']) move += 1;

        if (player1Gamepad?.connected) {
          if (player1Gamepad.buttons.left || player1Gamepad.axes[0] < -0.3) move = -1;
          if (player1Gamepad.buttons.right || player1Gamepad.axes[0] > 0.3) move = 1;
        }

        if (mobileTouchX.current !== null) {
          const targetX = mobileTouchX.current - playerRef.current.w / 2;
          const diff = targetX - playerRef.current.x;
          move = Math.sign(diff) * Math.min(1, Math.abs(diff) / 10);
        }

        playerRef.current.x += move * playerRef.current.speed;
        playerRef.current.x = Math.max(12, Math.min(width - playerRef.current.w - 12, playerRef.current.x));

        // Move Aliens
        stepTimerRef.current += 1;
        const aliveAliens = aliensRef.current.filter(a => a.alive);
        const stepRate = Math.max(8, Math.floor(aliveAliens.length / 2));

        if (stepTimerRef.current > stepRate) {
          stepTimerRef.current = 0;

          let hitWall = false;
          for (const al of aliveAliens) {
            const nextX = al.x + alienDirRef.current * 14;
            if (nextX <= 20 || nextX >= width - 45) {
              hitWall = true;
              break;
            }
          }

          if (hitWall) {
            alienDirRef.current *= -1;
            for (const al of aliveAliens) {
              al.y += 16;
              // Check invade reach
              if (al.y + 20 >= playerRef.current.y) {
                setGameOver(true);
                setIsPlaying(false);
                sound.playGameOver();
                break;
              }
            }
          } else {
            for (const al of aliveAliens) {
              al.x += alienDirRef.current * 14;
            }
          }
        }

        // Alien shooting
        if (Math.random() < 0.04 && aliveAliens.length > 0) {
          const shooter = aliveAliens[Math.floor(Math.random() * aliveAliens.length)];
          alienBulletsRef.current.push({
            x: shooter.x + 10,
            y: shooter.y + 16,
            vy: 4.5,
          });
        }

        // UFO Saucer
        if (!ufoRef.current && Math.random() < 0.003) {
          ufoRef.current = { x: -40, y: 30, active: true, points: 300 };
        }
        if (ufoRef.current && ufoRef.current.active) {
          ufoRef.current.x += 3;
          if (ufoRef.current.x > width + 40) {
            ufoRef.current = null;
          }
        }

        // Update Player Bullets
        for (let i = playerBulletsRef.current.length - 1; i >= 0; i--) {
          const b = playerBulletsRef.current[i];
          b.y += b.vy;

          // Check hit with UFO
          if (ufoRef.current && ufoRef.current.active) {
            if (b.x >= ufoRef.current.x && b.x <= ufoRef.current.x + 40 && b.y <= 45 && b.y >= 20) {
              sound.playExplosion();
              scoreRef.current += ufoRef.current.points;
              setScore(scoreRef.current);
              ufoRef.current = null;
              playerBulletsRef.current.splice(i, 1);
              storage.unlockAchievement('invaders_mothership');
              continue;
            }
          }

          // Check hit with Aliens
          let hitAlien = false;
          for (const al of aliveAliens) {
            if (b.x >= al.x && b.x <= al.x + 24 && b.y >= al.y && b.y <= al.y + 20) {
              al.alive = false;
              sound.playPaddleHit(800);
              scoreRef.current += al.points;
              setScore(scoreRef.current);
              playerBulletsRef.current.splice(i, 1);
              hitAlien = true;
              break;
            }
          }
          if (hitAlien) continue;

          // Check hit with Bunkers
          for (const bk of bunkersRef.current) {
            if (bk.hp > 0 && b.x >= bk.x && b.x <= bk.x + 10 && b.y >= bk.y && b.y <= bk.y + 10) {
              bk.hp -= 1;
              playerBulletsRef.current.splice(i, 1);
              break;
            }
          }

          if (b.y < 0) {
            playerBulletsRef.current.splice(i, 1);
          }
        }

        // Update Alien Bullets
        for (let i = alienBulletsRef.current.length - 1; i >= 0; i--) {
          const ab = alienBulletsRef.current[i];
          ab.y += ab.vy;

          // Check Bunker hit
          for (const bk of bunkersRef.current) {
            if (bk.hp > 0 && ab.x >= bk.x && ab.x <= bk.x + 10 && ab.y >= bk.y && ab.y <= bk.y + 10) {
              bk.hp -= 1;
              alienBulletsRef.current.splice(i, 1);
              break;
            }
          }

          // Check Player hit
          const p = playerRef.current;
          if (ab.x >= p.x && ab.x <= p.x + p.w && ab.y >= p.y && ab.y <= p.y + p.h) {
            sound.playExplosion();
            alienBulletsRef.current.splice(i, 1);
            setLives(prev => {
              const next = prev - 1;
              if (next <= 0) {
                setGameOver(true);
                setIsPlaying(false);
                sound.playGameOver();
                const entry = storage.addHighScore({
                  gameId: 'space-invaders',
                  playerName: 'AWC Vanguard',
                  avatar: '🛸',
                  score: scoreRef.current,
                  levelReached: waveRef.current,
                  device: player1Gamepad?.connected ? 'Gamepad' : 'Keyboard',
                });
                if (onScoreSaved) onScoreSaved(entry);
              }
              return next;
            });
            continue;
          }

          if (ab.y > height) {
            alienBulletsRef.current.splice(i, 1);
          }
        }

        // Wave Cleared
        if (aliveAliens.length === 0) {
          waveRef.current += 1;
          setWave(waveRef.current);
          sound.playVictory();
          initAliens(waveRef.current);
          const achWave = storage.updateAchievementProgress('invaders_wave_5', waveRef.current);
          if (achWave && onAchievementUnlocked) onAchievementUnlocked(achWave.title, achWave.xp);
        }
      }

      // Render Aliens
      aliensRef.current.forEach(al => {
        if (!al.alive) return;
        ctx.fillStyle = al.type === 'squid' ? '#a855f7' : al.type === 'crab' ? '#06b6d4' : '#22c55e';
        // 8-bit alien shape
        ctx.fillRect(al.x + 4, al.y, 16, 4);
        ctx.fillRect(al.x, al.y + 4, 24, 8);
        ctx.fillRect(al.x + 2, al.y + 12, 6, 6);
        ctx.fillRect(al.x + 16, al.y + 12, 6, 6);
      });

      // Render UFO
      if (ufoRef.current && ufoRef.current.active) {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(ufoRef.current.x + 8, ufoRef.current.y, 24, 4);
        ctx.fillRect(ufoRef.current.x, ufoRef.current.y + 4, 40, 6);
        ctx.fillRect(ufoRef.current.x + 4, ufoRef.current.y + 10, 32, 4);
      }

      // Render Bunkers
      bunkersRef.current.forEach(bk => {
        if (bk.hp <= 0) return;
        ctx.fillStyle = bk.hp === 3 ? '#10b981' : bk.hp === 2 ? '#eab308' : '#ef4444';
        ctx.fillRect(bk.x, bk.y, 9, 9);
      });

      // Render Player Cannon
      const pl = playerRef.current;
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(pl.x, pl.y + 8, pl.w, pl.h - 8);
      ctx.fillRect(pl.x + pl.w / 2 - 3, pl.y, 6, 8);

      // Render Bullets
      ctx.fillStyle = '#38bdf8';
      playerBulletsRef.current.forEach(b => {
        ctx.fillRect(b.x - 1.5, b.y, 3, 10);
      });

      ctx.fillStyle = '#f43f5e';
      alienBulletsRef.current.forEach(ab => {
        ctx.fillRect(ab.x - 1.5, ab.y, 3, 8);
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, isPaused, player1Gamepad, onAchievementUnlocked, onScoreSaved, initAliens]);

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl">
        <div className="flex items-center gap-3">
          <span className="font-arcade text-xs text-emerald-400">SPACE INVADERS</span>
          <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
            WAVE {wave}
          </span>
          <div className="flex items-center gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart
                key={i}
                className={`w-4 h-4 ${i < lives ? 'text-emerald-400 fill-emerald-400' : 'text-slate-700'}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-slate-400">Score: <strong className="text-emerald-400 text-sm">{score}</strong></span>
        </div>

        <div className="flex items-center gap-2">
          {!isPlaying ? (
            <button
              onClick={startGame}
              className="retro-btn px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-arcade text-xs rounded font-bold cursor-pointer"
            >
              DEFEND
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
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative w-full aspect-[16/10] max-h-[540px] bg-slate-950 rounded-2xl border-2 border-emerald-500/30 overflow-hidden shadow-2xl crt-overlay">
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          className="w-full h-full object-contain block bg-slate-950"
        />

        {/* Mobile touch zone */}
        <div
          className="absolute inset-x-0 bottom-0 h-28 touch-none flex items-center justify-between px-6 opacity-60"
          onTouchMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const touch = e.touches[0];
            mobileTouchX.current = ((touch.clientX - rect.left) / rect.width) * 800;
          }}
          onTouchEnd={() => { mobileTouchX.current = null; }}
        >
          <span className="font-arcade text-[10px] text-emerald-400">SLIDE CANNON</span>
          <button
            onClick={shootPlayerBullet}
            className="px-4 py-2 bg-emerald-600 text-slate-950 font-arcade text-xs rounded shadow-lg pointer-events-auto"
          >
            FIRE
          </button>
        </div>

        {gameOver && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <h2 className="font-arcade text-xl text-red-500 mb-2">ARMADA INVASION!</h2>
            <p className="text-sm font-mono text-slate-300 mb-6">Final Score: {score}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={startGame}
                className="retro-btn px-6 py-2.5 bg-emerald-500 text-slate-950 font-arcade text-xs rounded font-bold cursor-pointer"
              >
                PLAY AGAIN
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

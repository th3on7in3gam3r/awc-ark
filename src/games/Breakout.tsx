import React, { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { GamepadState, HighScoreEntry, ScoreSubmissionData } from '../types';
import { sound } from '../services/sound';
import { storage } from '../services/storage';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Heart, Zap, Trophy } from 'lucide-react';

interface BreakoutProps {
  player1Gamepad: GamepadState | null;
  onScoreSaved?: (entry: HighScoreEntry) => void;
  onAchievementUnlocked?: (title: string, xp: number) => void;
}

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  color: string;
  points: number;
  special?: 'laser' | 'multiball' | 'bomb' | 'expand';
}

interface DropItem {
  x: number;
  y: number;
  vy: number;
  type: 'laser' | 'multiball' | 'bomb' | 'expand';
  color: string;
}

export const Breakout: React.FC<BreakoutProps> = ({
  player1Gamepad,
  onScoreSaved,
  onAchievementUnlocked,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [combo, setCombo] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [victory, setVictory] = useState(false);
  const [laserAmmo, setLaserAmmo] = useState(0);
  const [isMuted, setIsMuted] = useState(sound.getMuted());

  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const mobileTouchX = useRef<number | null>(null);

  const paddleRef = useRef({ x: 350, y: 460, w: 90, h: 14, speed: 8 });
  const ballsRef = useRef<{ x: number; y: number; vx: number; vy: number; radius: number }[]>([]);
  const bricksRef = useRef<Brick[]>([]);
  const dropsRef = useRef<DropItem[]>([]);
  const lasersRef = useRef<{ x: number; y: number; vy: number }[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  const scoreRef = useRef(0);
  const comboRef = useRef(1);

  // Initialize Bricks for Level
  const initLevelBricks = useCallback((lvl: number, width: number) => {
    const bricks: Brick[] = [];
    const rows = 4 + lvl;
    const cols = 10;
    const padding = 6;
    const brickW = (width - 40 - (cols - 1) * padding) / cols;
    const brickH = 18;
    const startY = 60;

    const rowColors = ['#f43f5e', '#fb923c', '#eab308', '#22c55e', '#06b6d4', '#a855f7'];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 20 + c * (brickW + padding);
        const y = startY + r * (brickH + padding);
        const color = rowColors[r % rowColors.length];

        let special: Brick['special'] = undefined;
        const rand = Math.random();
        if (rand < 0.08) special = 'laser';
        else if (rand < 0.16) special = 'multiball';
        else if (rand < 0.22) special = 'bomb';
        else if (rand < 0.28) special = 'expand';

        bricks.push({
          x,
          y,
          w: brickW,
          h: brickH,
          hp: r === 0 && lvl > 1 ? 2 : 1,
          color,
          points: (rows - r) * 50,
          special,
        });
      }
    }
    bricksRef.current = bricks;
  }, []);

  const resetBall = useCallback((width: number, height: number) => {
    ballsRef.current = [
      {
        x: width / 2,
        y: height - 60,
        vx: (Math.random() > 0.5 ? 1 : -1) * 4.5,
        vy: -5.5,
        radius: 6,
      },
    ];
    paddleRef.current.x = width / 2 - paddleRef.current.w / 2;
  }, []);

  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    scoreRef.current = 0;
    comboRef.current = 1;
    setScore(0);
    setCombo(1);
    setLives(3);
    setLaserAmmo(0);
    setGameOver(false);
    setVictory(false);
    setIsPlaying(true);
    setIsPaused(false);
    dropsRef.current = [];
    lasersRef.current = [];

    initLevelBricks(level, canvas.width);
    resetBall(canvas.width, canvas.height);
    sound.playScore();
  }, [level, initLevelBricks, resetBall]);

  const firePaddleLaser = useCallback(() => {
    if (laserAmmo > 0 && isPlaying && !isPaused) {
      setLaserAmmo(prev => prev - 1);
      sound.playLaser();
      const p = paddleRef.current;
      lasersRef.current.push(
        { x: p.x + 8, y: p.y - 4, vy: -10 },
        { x: p.x + p.w - 8, y: p.y - 4, vy: -10 }
      );
    }
  }, [laserAmmo, isPlaying, isPaused]);

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
        firePaddleLaser();
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
  }, [firePaddleLaser]);

  useEffect(() => {
    if (player1Gamepad?.buttons.a) {
      firePaddleLaser();
    }
  }, [player1Gamepad?.buttons.a, firePaddleLaser]);

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

      // Grid background
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 35) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 35) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (isPlaying && !isPaused) {
        // Move paddle
        const p = paddleRef.current;
        let move = 0;
        if (keysPressed.current['arrowleft'] || keysPressed.current['a']) move -= 1;
        if (keysPressed.current['arrowright'] || keysPressed.current['d']) move += 1;

        if (player1Gamepad?.connected) {
          if (player1Gamepad.buttons.left || player1Gamepad.axes[0] < -0.3) move = -1;
          if (player1Gamepad.buttons.right || player1Gamepad.axes[0] > 0.3) move = 1;
        }

        if (mobileTouchX.current !== null) {
          const targetX = mobileTouchX.current - p.w / 2;
          const diff = targetX - p.x;
          move = Math.sign(diff) * Math.min(1, Math.abs(diff) / 12);
        }

        p.x += move * p.speed;
        p.x = Math.max(8, Math.min(width - p.w - 8, p.x));

        // Update Lasers
        for (let i = lasersRef.current.length - 1; i >= 0; i--) {
          const lz = lasersRef.current[i];
          lz.y += lz.vy;

          // Check hit with bricks
          for (let b = bricksRef.current.length - 1; b >= 0; b--) {
            const br = bricksRef.current[b];
            if (lz.x >= br.x && lz.x <= br.x + br.w && lz.y >= br.y && lz.y <= br.y + br.h) {
              br.hp -= 1;
              sound.playExplosion();
              if (br.hp <= 0) {
                scoreRef.current += br.points;
                setScore(scoreRef.current);
                bricksRef.current.splice(b, 1);
              }
              lasersRef.current.splice(i, 1);
              break;
            }
          }

          if (lz.y < 0) {
            lasersRef.current.splice(i, 1);
          }
        }

        // Update Drops
        for (let i = dropsRef.current.length - 1; i >= 0; i--) {
          const dp = dropsRef.current[i];
          dp.y += dp.vy;

          if (dp.y + 10 >= p.y && dp.y - 10 <= p.y + p.h && dp.x >= p.x && dp.x <= p.x + p.w) {
            sound.playPowerup();
            if (dp.type === 'laser') setLaserAmmo(prev => prev + 6);
            else if (dp.type === 'multiball') {
              ballsRef.current.push(
                { x: p.x + p.w / 2, y: p.y - 10, vx: -4, vy: -5, radius: 6 },
                { x: p.x + p.w / 2, y: p.y - 10, vx: 4, vy: -5, radius: 6 }
              );
            } else if (dp.type === 'expand') {
              p.w = 130;
              setTimeout(() => { p.w = 90; }, 9000);
            } else if (dp.type === 'bomb') {
              // Destroy nearest 3 bricks
              if (bricksRef.current.length > 0) {
                bricksRef.current.splice(0, Math.min(3, bricksRef.current.length));
                sound.playExplosion();
              }
            }
            dropsRef.current.splice(i, 1);
            continue;
          }

          if (dp.y > height) {
            dropsRef.current.splice(i, 1);
          }
        }

        // Update Balls
        for (let bIndex = ballsRef.current.length - 1; bIndex >= 0; bIndex--) {
          const ball = ballsRef.current[bIndex];
          ball.x += ball.vx;
          ball.y += ball.vy;

          // Wall bounce
          if (ball.x - ball.radius <= 6) {
            ball.x = 6 + ball.radius;
            ball.vx *= -1;
            sound.playWallBounce();
          } else if (ball.x + ball.radius >= width - 6) {
            ball.x = width - 6 - ball.radius;
            ball.vx *= -1;
            sound.playWallBounce();
          }

          if (ball.y - ball.radius <= 6) {
            ball.y = 6 + ball.radius;
            ball.vy *= -1;
            sound.playWallBounce();
          }

          // Paddle collision
          if (
            ball.y + ball.radius >= p.y &&
            ball.y - ball.radius <= p.y + p.h &&
            ball.x >= p.x &&
            ball.x <= p.x + p.w &&
            ball.vy > 0
          ) {
            ball.y = p.y - ball.radius;
            const hitPos = (ball.x - (p.x + p.w / 2)) / (p.w / 2);
            const speed = Math.hypot(ball.vx, ball.vy);
            const angle = hitPos * (Math.PI / 3);
            ball.vx = Math.sin(angle) * speed;
            ball.vy = -Math.abs(Math.cos(angle) * speed);

            comboRef.current = 1;
            setCombo(1);
            sound.playPaddleHit(480);
          }

          // Brick collision
          for (let i = bricksRef.current.length - 1; i >= 0; i--) {
            const br = bricksRef.current[i];
            if (
              ball.x + ball.radius >= br.x &&
              ball.x - ball.radius <= br.x + br.w &&
              ball.y + ball.radius >= br.y &&
              ball.y - ball.radius <= br.y + br.h
            ) {
              ball.vy *= -1;
              br.hp -= 1;
              sound.playPaddleHit(600);

              if (br.hp <= 0) {
                sound.playExplosion();
                const gained = br.points * comboRef.current;
                scoreRef.current += gained;
                setScore(scoreRef.current);

                comboRef.current = Math.min(5, comboRef.current + 1);
                setCombo(comboRef.current);
                if (comboRef.current >= 5) {
                  const achCombo = storage.updateAchievementProgress('breakout_multi_5x', 5);
                  if (achCombo && onAchievementUnlocked) onAchievementUnlocked(achCombo.title, achCombo.xp);
                }

                // Drop item
                if (br.special) {
                  dropsRef.current.push({
                    x: br.x + br.w / 2,
                    y: br.y + br.h / 2,
                    vy: 2.2,
                    type: br.special,
                    color: br.color,
                  });
                }

                bricksRef.current.splice(i, 1);
              }
              break;
            }
          }

          // Bottom loss
          if (ball.y - ball.radius > height) {
            ballsRef.current.splice(bIndex, 1);
            if (ballsRef.current.length === 0) {
              setLives(prev => {
                const next = prev - 1;
                if (next <= 0) {
                  setGameOver(true);
                  setIsPlaying(false);
                  sound.playGameOver();

                  // Save Score
                  const entry = storage.addHighScore({
                    gameId: 'breakout',
                    playerName: 'AWC Vanguard',
                    avatar: '🧱',
                    score: scoreRef.current,
                    levelReached: level,
                    device: player1Gamepad?.connected ? 'Gamepad' : 'Keyboard',
                  });
                  if (onScoreSaved) onScoreSaved(entry);
                } else {
                  sound.playWallBounce();
                  resetBall(width, height);
                }
                return next;
              });
            }
          }
        }

        // Win check
        if (bricksRef.current.length === 0) {
          setVictory(true);
          setIsPlaying(false);
          sound.playVictory();
          confetti({ particleCount: 90, spread: 60 });
          storage.unlockAchievement('breakout_clean_sweep');
          const entry = storage.addHighScore({
            gameId: 'breakout',
            playerName: 'AWC Vanguard',
            avatar: '🏆',
            score: scoreRef.current + 5000,
            levelReached: level,
            device: player1Gamepad?.connected ? 'Gamepad' : 'Keyboard',
          });
          if (onScoreSaved) onScoreSaved(entry);
        }
      }

      // Render Bricks
      bricksRef.current.forEach(br => {
        ctx.fillStyle = br.color;
        ctx.fillRect(br.x, br.y, br.w, br.h);
        ctx.strokeStyle = '#ffffff30';
        ctx.lineWidth = 1;
        ctx.strokeRect(br.x, br.y, br.w, br.h);

        if (br.special) {
          ctx.font = '9px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(br.special[0].toUpperCase(), br.x + br.w / 2, br.y + br.h / 2 + 3);
        }
      });

      // Render Paddle
      const p = paddleRef.current;
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x, p.y, p.w, p.h);

      // Render Balls
      ballsRef.current.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      });

      // Render Drops
      dropsRef.current.forEach(dp => {
        ctx.beginPath();
        ctx.arc(dp.x, dp.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = dp.color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Render Lasers
      lasersRef.current.forEach(lz => {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(lz.x - 2, lz.y - 6, 4, 12);
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    animationFrameRef.current = animId;

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, isPaused, level, player1Gamepad, onAchievementUnlocked, onScoreSaved, resetBall]);

  return (
    <div className="flex flex-col gap-2 sm:gap-3 w-full h-full min-h-0">
      {/* Header Bar */}
      <div className="ark-game-bar shrink-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-slate-900 border border-slate-800 px-3 py-2 sm:p-3 rounded-xl">
        <div className="flex items-center gap-3">
          <span className="ark-game-title font-arcade text-xs text-amber-400">BREAKOUT DELUXE</span>
          <div className="flex items-center gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart
                key={i}
                className={`w-4 h-4 ${i < lives ? 'text-red-500 fill-red-500' : 'text-slate-700'}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-slate-400">Score: <strong className="text-amber-400 text-sm">{score}</strong></span>
          <span className="text-slate-400">Combo: <strong className="text-emerald-400">{combo}x</strong></span>
          {laserAmmo > 0 && (
            <span className="text-rose-400 flex items-center gap-1 font-bold">
              <Zap className="w-3.5 h-3.5 fill-current" /> Lasers: {laserAmmo}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isPlaying ? (
            <button
              onClick={startGame}
              className="retro-btn px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-arcade text-xs rounded font-bold cursor-pointer"
            >
              LAUNCH
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
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>
        </div>
      </div>

      {/* Canvas */}
      {/* Grows to the biggest 16:10 that fits the space, so nothing scrolls. */}
      <div className="flex-1 min-h-0 flex items-center justify-center" style={{ containerType: 'size' }}>
      <div className="relative aspect-[16/10] bg-slate-950 rounded-2xl border-2 border-amber-500/30 overflow-hidden shadow-2xl crt-overlay" style={{ width: 'min(100cqw, 160cqh)' }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          className="w-full h-full object-contain block bg-slate-950"
        />

        {/* Drag on the board to steer the paddle too (the on-screen pad is the main control). */}
        <div
          className="absolute inset-x-0 bottom-0 h-28 touch-none"
          aria-hidden="true"
          onTouchStart={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            mobileTouchX.current = ((e.touches[0].clientX - rect.left) / rect.width) * 800;
          }}
          onTouchMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            mobileTouchX.current = ((e.touches[0].clientX - rect.left) / rect.width) * 800;
          }}
          onTouchEnd={() => { mobileTouchX.current = null; }}
          onTouchCancel={() => { mobileTouchX.current = null; }}
        />

        {gameOver && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <h2 className="font-arcade text-xl text-red-500 mb-2">GAME OVER</h2>
            <p className="text-sm font-mono text-slate-300 mb-6">Final Score: {score}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={startGame}
                className="retro-btn px-6 py-2.5 bg-amber-500 text-slate-950 font-arcade text-xs rounded font-bold cursor-pointer"
              >
                TRY AGAIN
              </button>
            </div>
          </div>
        )}

        {victory && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <Trophy className="w-12 h-12 text-yellow-400 mb-2 animate-bounce" />
            <h2 className="font-arcade text-xl text-yellow-400 mb-2">STAGE CLEARED!</h2>
            <p className="text-sm font-mono text-slate-300 mb-6">Final Score: {score}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => { setLevel(l => l + 1); startGame(); }}
                className="retro-btn px-6 py-2.5 bg-emerald-500 text-slate-950 font-arcade text-xs rounded font-bold cursor-pointer"
              >
                NEXT STAGE
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

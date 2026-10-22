import React, { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { GamepadState, GameDifficulty, HighScoreEntry, ScoreSubmissionData } from '../types';
import { sound } from '../services/sound';
import { storage } from '../services/storage';
import { 
  Play, Pause, RotateCcw, Volume2, VolumeX, Shield, 
  Zap, Swords, User, Bot, Sparkles, Trophy, Settings2
} from 'lucide-react';

interface PongPlusProps {
  player1Gamepad: GamepadState | null;
  player2Gamepad: GamepadState | null;
  onScoreSaved?: (entry: HighScoreEntry) => void;
  onAchievementUnlocked?: (title: string, xp: number) => void;
  /** Short screen (phone sideways): hide the options bar during a match so the arena stays big. */
  compact?: boolean;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  isMain?: boolean;
  lastHitBy?: 1 | 2;
}

interface PowerUp {
  x: number;
  y: number;
  type: 'multiball' | 'laser' | 'shield' | 'nitro' | 'mega' | 'freeze';
  duration: number;
  radius: number;
  label: string;
  color: string;
}

interface LaserBolt {
  x: number;
  y: number;
  vx: number;
  player: 1 | 2;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface ArenaObstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  vy: number;
}

export const PongPlus: React.FC<PongPlusProps> = ({
  player1Gamepad,
  player2Gamepad,
  onScoreSaved,
  onAchievementUnlocked,
  compact = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Game Configuration State
  const [mode, setMode] = useState<'1p' | '2p'>('1p');
  const [difficulty, setDifficulty] = useState<GameDifficulty>('medium');
  const [powerupsEnabled, setPowerupsEnabled] = useState(true);
  const [level, setLevel] = useState(1);
  const [targetScore, setTargetScore] = useState(7);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [winner, setWinner] = useState<'p1' | 'p2' | null>(null);
  const [rallyCount, setRallyCount] = useState(0);
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);

  // Active status
  const [p1HasShield, setP1HasShield] = useState(false);
  const [p2HasShield, setP2HasShield] = useState(false);
  const [p1LaserCharges, setP1LaserCharges] = useState(0);
  const [p2LaserCharges, setP2LaserCharges] = useState(0);
  const [p1StunnedUntil, setP1StunnedUntil] = useState(0);
  const [p2StunnedUntil, setP2StunnedUntil] = useState(0);

  // Sound
  const [isMuted, setIsMuted] = useState(sound.getMuted());

  // Input Tracking
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const mobileP1TouchY = useRef<number | null>(null);
  const mobileP2TouchY = useRef<number | null>(null);

  // Physics & Game loop refs
  const p1PaddleRef = useRef({ y: 200, h: 80, w: 14, speed: 6.5 });
  const p2PaddleRef = useRef({ y: 200, h: 80, w: 14, speed: 6.5 });
  const ballsRef = useRef<Ball[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const lasersRef = useRef<LaserBolt[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const obstaclesRef = useRef<ArenaObstacle[]>([]);
  const rallyRef = useRef(0);
  const p1ScoreRef = useRef(0);
  const p2ScoreRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const powerupTimerRef = useRef<number>(0);

  // Reset ball to center
  const resetBall = useCallback((towardsPlayer: 1 | 2 = 1) => {
    const canvas = canvasRef.current;
    const w = canvas ? canvas.width : 800;
    const h = canvas ? canvas.height : 500;
    
    const baseSpeed = difficulty === 'easy' ? 4.5 : difficulty === 'medium' ? 6 : difficulty === 'hard' ? 7.5 : 9;
    const dir = towardsPlayer === 1 ? -1 : 1;
    const angle = (Math.random() * 0.8 - 0.4) * Math.PI; // -36 to +36 deg

    ballsRef.current = [
      {
        x: w / 2,
        y: h / 2,
        vx: Math.cos(angle) * baseSpeed * dir,
        vy: Math.sin(angle) * baseSpeed,
        radius: 7,
        color: '#22d3ee', // Cyan
        isMain: true,
        lastHitBy: towardsPlayer === 1 ? 2 : 1,
      },
    ];
    rallyRef.current = 0;
    setRallyCount(0);
  }, [difficulty]);

  // Trigger win
  const handleVictory = useCallback((victor: 'p1' | 'p2') => {
    setWinner(victor);
    setIsPlaying(false);
    sound.playVictory();
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: victor === 'p1' ? ['#06b6d4', '#3b82f6', '#ec4899'] : ['#f43f5e', '#fbbf24', '#a855f7'],
    });

    // Check & save achievements
    const ach1 = storage.unlockAchievement('pong_first_win');
    if (ach1 && onAchievementUnlocked) {
      onAchievementUnlocked(ach1.title, ach1.xp);
    }
    if (mode === '2p') {
      const achPvp = storage.updateAchievementProgress('pong_pvp_champion', 3);
      if (achPvp && onAchievementUnlocked) {
        onAchievementUnlocked(achPvp.title, achPvp.xp);
      }
    }
    if (level === 5 && victor === 'p1') {
      const achBoss = storage.unlockAchievement('pong_boss_slayer');
      if (achBoss && onAchievementUnlocked) {
        onAchievementUnlocked(achBoss.title, achBoss.xp);
      }
    }
    if (victor === 'p1' && p2ScoreRef.current === 0) {
      const achClean = storage.unlockAchievement('pong_clean_sheet');
      if (achClean && onAchievementUnlocked) {
        onAchievementUnlocked(achClean.title, achClean.xp);
      }
    }

    // Save high score
    const finalScore = p1ScoreRef.current * 1500 + rallyRef.current * 80 + level * 500;
    const entry = storage.addHighScore({
      gameId: 'pong-plus',
      playerName: victor === 'p1' ? 'AWC Player 1' : 'AWC Challenger',
      avatar: victor === 'p1' ? '🏆' : '👾',
      score: finalScore,
      levelReached: level,
      device: player1Gamepad?.connected ? 'Gamepad' : 'Keyboard',
      // Two people on one screen: there's no single player to credit, so it isn't ranked.
      twoPlayer: mode === '2p',
      stats: { rallyPeak: rallyRef.current },
    });
    if (onScoreSaved) {
      onScoreSaved(entry);
    }
  }, [mode, level, player1Gamepad, onAchievementUnlocked, onScoreSaved]);

  // Spawn particle sparks
  const spawnSparks = (x: number, y: number, color: string, count = 8) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: Math.random() * 0.3 + 0.2,
        color,
        size: Math.random() * 3 + 2,
      });
    }
  };

  // Setup level obstacles
  const setupLevelObstacles = useCallback((lvl: number, width: number, height: number) => {
    obstaclesRef.current = [];
    if (lvl === 2) {
      // Asteroid Core in middle
      obstaclesRef.current = [
        { x: width / 2 - 12, y: height * 0.25, w: 24, h: 50, vy: 1.5 },
        { x: width / 2 - 12, y: height * 0.75 - 50, w: 24, h: 50, vy: -1.5 },
      ];
    } else if (lvl === 3) {
      // Warp Portals
      obstaclesRef.current = [
        { x: width * 0.35, y: height * 0.3, w: 18, h: 45, vy: 0 },
        { x: width * 0.65, y: height * 0.7, w: 18, h: 45, vy: 0 },
      ];
    } else if (lvl === 4) {
      // Gravity Singularity
      obstaclesRef.current = [
        { x: width / 2 - 20, y: height / 2 - 20, w: 40, h: 40, vy: 0 },
      ];
    } else if (lvl === 5) {
      // Overdrive Boss Drone
      obstaclesRef.current = [
        { x: width / 2 - 15, y: height / 2 - 60, w: 30, h: 120, vy: 2.5 },
      ];
    }
  }, []);

  // Fire laser
  const fireLaser = useCallback((player: 1 | 2) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (player === 1 && p1LaserCharges > 0) {
      setP1LaserCharges(prev => prev - 1);
      sound.playLaser();
      lasersRef.current.push({
        x: 35,
        y: p1PaddleRef.current.y + p1PaddleRef.current.h / 2,
        vx: 12,
        player: 1,
      });
    } else if (player === 2 && p2LaserCharges > 0) {
      setP2LaserCharges(prev => prev - 1);
      sound.playLaser();
      lasersRef.current.push({
        x: canvas.width - 35,
        y: p2PaddleRef.current.y + p2PaddleRef.current.h / 2,
        vx: -12,
        player: 2,
      });
    }
  }, [p1LaserCharges, p2LaserCharges]);

  // Start / Restart Game
  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    p1ScoreRef.current = 0;
    p2ScoreRef.current = 0;
    setP1Score(0);
    setP2Score(0);
    setWinner(null);
    setIsPlaying(true);
    setIsPaused(false);
    p1PaddleRef.current = { y: canvas.height / 2 - 40, h: 80, w: 14, speed: 6.5 };
    p2PaddleRef.current = { y: canvas.height / 2 - 40, h: 80, w: 14, speed: 6.5 };
    setP1HasShield(false);
    setP2HasShield(false);
    setP1LaserCharges(0);
    setP2LaserCharges(0);
    powerUpsRef.current = [];
    lasersRef.current = [];
    particlesRef.current = [];
    setupLevelObstacles(level, canvas.width, canvas.height);
    resetBall(1);
    sound.playScore();
  }, [level, resetBall, setupLevelObstacles]);

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

  // Key listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyLower = e.key.toLowerCase();
      // Prevent browser viewport from scrolling on game control keys
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) ||
        ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(keyLower)
      ) {
        e.preventDefault();
      }

      keysPressed.current[keyLower] = true;
      if ((e.key === ' ' || e.code === 'Space') && isPlaying && !isPaused) {
        fireLaser(1);
      }
      if (e.key === 'Enter' && isPlaying && !isPaused && mode === '2p') {
        fireLaser(2);
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
  }, [isPlaying, isPaused, mode, fireLaser]);

  // Gamepad Fire trigger check
  useEffect(() => {
    if (isPlaying && !isPaused) {
      if (player1Gamepad?.buttons.a) {
        fireLaser(1);
      }
      if (player2Gamepad?.buttons.a) {
        fireLaser(2);
      }
    }
  }, [player1Gamepad?.buttons.a, player2Gamepad?.buttons.a, isPlaying, isPaused, fireLaser]);

  // Main Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const gameLoop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      const width = canvas.width;
      const height = canvas.height;

      // Clear & Background
      ctx.fillStyle = '#05070f';
      ctx.fillRect(0, 0, width, height);

      // Draw Retro Grid Lines
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw Center Dashed Line
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Arena Borders with Neon glow
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, width - 8, height - 8);

      if (isPlaying && !isPaused) {
        const now = Date.now();

        // 1. Update Player 1 Paddle
        const p1 = p1PaddleRef.current;
        if (now > p1StunnedUntil) {
          let p1Move = 0;
          if (keysPressed.current['w'] || keysPressed.current['arrowup']) p1Move -= 1;
          if (keysPressed.current['s'] || keysPressed.current['arrowdown']) p1Move += 1;

          // Gamepad 1 override
          if (player1Gamepad?.connected) {
            if (player1Gamepad.buttons.up || player1Gamepad.axes[1] < -0.3) p1Move = -1;
            if (player1Gamepad.buttons.down || player1Gamepad.axes[1] > 0.3) p1Move = 1;
          }

          // Mobile Touch 1 override
          if (mobileP1TouchY.current !== null) {
            const targetY = mobileP1TouchY.current - p1.h / 2;
            const diff = targetY - p1.y;
            p1Move = Math.sign(diff) * Math.min(1, Math.abs(diff) / 10);
          }

          p1.y += p1Move * p1.speed;
        }
        p1.y = Math.max(8, Math.min(height - p1.h - 8, p1.y));

        // 2. Update Player 2 / AI Paddle
        const p2 = p2PaddleRef.current;
        if (now > p2StunnedUntil) {
          if (mode === '2p') {
            let p2Move = 0;
            if (keysPressed.current['arrowup']) p2Move -= 1;
            if (keysPressed.current['arrowdown']) p2Move += 1;

            if (player2Gamepad?.connected) {
              if (player2Gamepad.buttons.up || player2Gamepad.axes[1] < -0.3) p2Move = -1;
              if (player2Gamepad.buttons.down || player2Gamepad.axes[1] > 0.3) p2Move = 1;
            }

            if (mobileP2TouchY.current !== null) {
              const targetY = mobileP2TouchY.current - p2.h / 2;
              const diff = targetY - p2.y;
              p2Move = Math.sign(diff) * Math.min(1, Math.abs(diff) / 10);
            }
            p2.y += p2Move * p2.speed;
          } else {
            // Adaptive AI
            const mainBall = ballsRef.current.find(b => b.isMain) || ballsRef.current[0];
            if (mainBall) {
              const aiCenter = p2.y + p2.h / 2;
              const targetY = mainBall.y;
              const aiSpeedMultiplier = difficulty === 'easy' ? 0.6 : difficulty === 'medium' ? 0.85 : difficulty === 'hard' ? 1.05 : 1.35;
              const aiSpeed = p2.speed * aiSpeedMultiplier;
              const errorMargin = difficulty === 'easy' ? 24 : difficulty === 'medium' ? 12 : difficulty === 'hard' ? 5 : 0;
              
              if (mainBall.vx > 0 || Math.random() < 0.2) {
                if (Math.abs(targetY - aiCenter) > errorMargin) {
                  if (targetY > aiCenter) {
                    p2.y += aiSpeed;
                  } else {
                    p2.y -= aiSpeed;
                  }
                }
              }
            }
          }
        }
        p2.y = Math.max(8, Math.min(height - p2.h - 8, p2.y));

        // 3. Spawn Power-ups
        if (powerupsEnabled) {
          powerupTimerRef.current += dt;
          if (powerupTimerRef.current > 7 && powerUpsRef.current.length < 3) {
            powerupTimerRef.current = 0;
            const types: PowerUp['type'][] = ['multiball', 'laser', 'shield', 'nitro', 'mega', 'freeze'];
            const chosen = types[Math.floor(Math.random() * types.length)];
            const colorMap = {
              multiball: '#a855f7',
              laser: '#ef4444',
              shield: '#3b82f6',
              nitro: '#f59e0b',
              mega: '#10b981',
              freeze: '#06b6d4',
            };
            const labelMap = {
              multiball: '3X',
              laser: '🔫',
              shield: '🛡️',
              nitro: '⚡',
              mega: '📏',
              freeze: '❄️',
            };
            powerUpsRef.current.push({
              x: width * 0.3 + Math.random() * (width * 0.4),
              y: height * 0.2 + Math.random() * (height * 0.6),
              type: chosen,
              duration: 10,
              radius: 14,
              color: colorMap[chosen],
              label: labelMap[chosen],
            });
          }
        }

        // 4. Update Obstacles
        obstaclesRef.current.forEach(obs => {
          obs.y += obs.vy;
          if (obs.y <= 12 || obs.y + obs.h >= height - 12) {
            obs.vy *= -1;
          }
        });

        // 5. Update Lasers
        for (let i = lasersRef.current.length - 1; i >= 0; i--) {
          const laser = lasersRef.current[i];
          laser.x += laser.vx;

          // Check hit on opponent paddle
          if (laser.player === 1) {
            if (laser.x >= width - 30 - p2.w && laser.y >= p2.y && laser.y <= p2.y + p2.h) {
              setP2StunnedUntil(Date.now() + 1400);
              sound.playExplosion();
              spawnSparks(laser.x, laser.y, '#ef4444', 12);
              lasersRef.current.splice(i, 1);
              continue;
            }
          } else {
            if (laser.x <= 30 + p1.w && laser.y >= p1.y && laser.y <= p1.y + p1.h) {
              setP1StunnedUntil(Date.now() + 1400);
              sound.playExplosion();
              spawnSparks(laser.x, laser.y, '#ef4444', 12);
              lasersRef.current.splice(i, 1);
              continue;
            }
          }

          if (laser.x < 0 || laser.x > width) {
            lasersRef.current.splice(i, 1);
          }
        }

        // 6. Update Balls & Collisions
        for (let bIndex = ballsRef.current.length - 1; bIndex >= 0; bIndex--) {
          const ball = ballsRef.current[bIndex];
          ball.x += ball.vx;
          ball.y += ball.vy;

          // Bounce off top and bottom walls
          if (ball.y - ball.radius <= 6) {
            ball.y = 6 + ball.radius;
            ball.vy *= -1;
            sound.playWallBounce();
            spawnSparks(ball.x, ball.y, '#38bdf8', 4);
          } else if (ball.y + ball.radius >= height - 6) {
            ball.y = height - 6 - ball.radius;
            ball.vy *= -1;
            sound.playWallBounce();
            spawnSparks(ball.x, ball.y, '#38bdf8', 4);
          }

          // Level 4 Singularity Gravity pull
          if (level === 4 && obstaclesRef.current[0]) {
            const sing = obstaclesRef.current[0];
            const cx = sing.x + sing.w / 2;
            const cy = sing.y + sing.h / 2;
            const dx = cx - ball.x;
            const dy = cy - ball.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 25 && dist < 180) {
              const pull = 0.22;
              ball.vx += (dx / dist) * pull;
              ball.vy += (dy / dist) * pull;
            }
          }

          // Obstacle collisions with penetration resolution
          for (const obs of obstaclesRef.current) {
            if (
              ball.x + ball.radius >= obs.x &&
              ball.x - ball.radius <= obs.x + obs.w &&
              ball.y + ball.radius >= obs.y &&
              ball.y - ball.radius <= obs.y + obs.h
            ) {
              const overlapLeft = (ball.x + ball.radius) - obs.x;
              const overlapRight = (obs.x + obs.w) - (ball.x - ball.radius);
              const overlapTop = (ball.y + ball.radius) - obs.y;
              const overlapBottom = (obs.y + obs.h) - (ball.y - ball.radius);
              const minOverlapX = Math.min(overlapLeft, overlapRight);
              const minOverlapY = Math.min(overlapTop, overlapBottom);

              if (minOverlapX < minOverlapY) {
                if (ball.vx > 0) {
                  ball.x = obs.x - ball.radius - 1;
                } else {
                  ball.x = obs.x + obs.w + ball.radius + 1;
                }
                ball.vx *= -1;
              } else {
                if (ball.vy > 0) {
                  ball.y = obs.y - ball.radius - 1;
                } else {
                  ball.y = obs.y + obs.h + ball.radius + 1;
                }
                ball.vy *= -1;
              }
              sound.playWallBounce();
              spawnSparks(ball.x, ball.y, '#f59e0b', 6);
            }
          }

          // Check PowerUp collisions
          for (let pIdx = powerUpsRef.current.length - 1; pIdx >= 0; pIdx--) {
            const pw = powerUpsRef.current[pIdx];
            const dist = Math.hypot(ball.x - pw.x, ball.y - pw.y);
            if (dist < ball.radius + pw.radius) {
              sound.playPowerup();
              spawnSparks(pw.x, pw.y, pw.color, 16);

              const lastHitByPlayer = ball.lastHitBy || (ball.vx > 0 ? 1 : 2);

              if (pw.type === 'multiball') {
                ballsRef.current.push(
                  { x: ball.x, y: ball.y, vx: ball.vx * 1.1, vy: -Math.abs(ball.vy) - 1, radius: 6, color: '#ec4899', lastHitBy: lastHitByPlayer },
                  { x: ball.x, y: ball.y, vx: ball.vx * 0.9, vy: Math.abs(ball.vy) + 1, radius: 6, color: '#a855f7', lastHitBy: lastHitByPlayer }
                );
                storage.unlockAchievement('pong_multiball_chaos');
              } else if (pw.type === 'laser') {
                if (lastHitByPlayer === 1) setP1LaserCharges(prev => prev + 3);
                else if (mode === '2p') setP2LaserCharges(prev => prev + 3);
              } else if (pw.type === 'shield') {
                if (mode === '1p') {
                  // In 1P mode, shield powerup is an exclusive player perk; AI never gets unfair goal shields
                  setP1HasShield(true);
                } else {
                  if (lastHitByPlayer === 1) setP1HasShield(true);
                  else setP2HasShield(true);
                }
              } else if (pw.type === 'mega') {
                if (lastHitByPlayer === 1) p1PaddleRef.current.h = 120;
                else p2PaddleRef.current.h = 120;
                setTimeout(() => {
                  p1PaddleRef.current.h = 80;
                  p2PaddleRef.current.h = 80;
                }, 8000);
              } else if (pw.type === 'freeze') {
                if (lastHitByPlayer === 1) setP2StunnedUntil(Date.now() + 1600);
                else setP1StunnedUntil(Date.now() + 1600);
              } else if (pw.type === 'nitro') {
                ball.vx *= 1.35;
                ball.vy *= 1.25;
              }

              powerUpsRef.current.splice(pIdx, 1);
            }
          }

          // Player 1 Paddle Collision (Left side)
          const p1X = 24;
          const p1FrontFace = p1X + p1.w; // 38
          const prevX = ball.x - ball.vx;

          if (
            ball.vx < 0 &&
            prevX >= p1FrontFace - 4 &&
            ball.x - ball.radius <= p1FrontFace &&
            ball.y + ball.radius * 0.75 >= p1.y &&
            ball.y - ball.radius * 0.75 <= p1.y + p1.h
          ) {
            ball.x = p1FrontFace + ball.radius;
            ball.lastHitBy = 1;
            // Angle reflection based on hit position
            const hitOffset = (ball.y - (p1.y + p1.h / 2)) / (p1.h / 2);
            const clampedOffset = Math.max(-1, Math.min(1, hitOffset));
            const speed = Math.min(16, Math.hypot(ball.vx, ball.vy) * 1.05);
            const angle = clampedOffset * (Math.PI / 3); // -60 to +60 deg
            ball.vx = Math.abs(Math.cos(angle) * speed);
            ball.vy = Math.sin(angle) * speed;

            rallyRef.current += 1;
            setRallyCount(rallyRef.current);
            sound.playPaddleHit(520);
            spawnSparks(p1FrontFace, ball.y, '#06b6d4', 8);

            // Progress rally achievement
            const achRally = storage.updateAchievementProgress('pong_rally_master', rallyRef.current);
            if (achRally && onAchievementUnlocked) {
              onAchievementUnlocked(achRally.title, achRally.xp);
            }
          }

          // Player 2 / AI Paddle Collision (Right side)
          // STRICT RULE: Ball must be in front of paddle face before collision step.
          // Balls that have passed the front face (prevX > p2FrontFace + 4) can NEVER be caught from behind.
          const p2X = width - 24 - p2.w;
          const p2FrontFace = p2X;

          if (
            ball.vx > 0 &&
            prevX <= p2FrontFace + 4 &&
            ball.x + ball.radius >= p2FrontFace &&
            ball.y + ball.radius * 0.75 >= p2.y &&
            ball.y - ball.radius * 0.75 <= p2.y + p2.h
          ) {
            ball.x = p2FrontFace - ball.radius;
            ball.lastHitBy = 2;
            const hitOffset = (ball.y - (p2.y + p2.h / 2)) / (p2.h / 2);
            const clampedOffset = Math.max(-1, Math.min(1, hitOffset));
            const speed = Math.min(16, Math.hypot(ball.vx, ball.vy) * 1.05);
            const angle = clampedOffset * (Math.PI / 3);
            ball.vx = -Math.abs(Math.cos(angle) * speed);
            ball.vy = Math.sin(angle) * speed;

            rallyRef.current += 1;
            setRallyCount(rallyRef.current);
            sound.playPaddleHit(420);
            spawnSparks(p2FrontFace, ball.y, '#ec4899', 8);
          }

          // Check Goal / Score Left (P2 / AI scores)
          if (ball.x - ball.radius <= 0) {
            if (p1HasShield) {
              setP1HasShield(false);
              ball.vx = Math.abs(ball.vx);
              ball.x = 16;
              sound.playWallBounce();
              spawnSparks(16, ball.y, '#3b82f6', 16);
            } else {
              ballsRef.current.splice(bIndex, 1);
              p2ScoreRef.current += 1;
              setP2Score(p2ScoreRef.current);
              sound.playGameOver();
              spawnSparks(6, ball.y, '#ec4899', 20);

              if (p2ScoreRef.current >= targetScore) {
                handleVictory('p2');
              } else if (ballsRef.current.length === 0) {
                resetBall(1);
              }
              continue;
            }
          }

          // Check Goal / Score Right (P1 scores)
          // Ball hit by P1 that beats the paddle cleanly exits the screen and awards the point!
          // In 1P mode, the opponent NEVER bounces the ball back.
          if (ball.x + ball.radius >= width) {
            if (mode === '2p' && p2HasShield) {
              setP2HasShield(false);
              ball.vx = -Math.abs(ball.vx);
              ball.x = width - 16;
              sound.playWallBounce();
              spawnSparks(width - 16, ball.y, '#3b82f6', 16);
            } else {
              ballsRef.current.splice(bIndex, 1);
              p1ScoreRef.current += 1;
              setP1Score(p1ScoreRef.current);
              sound.playScore();
              spawnSparks(width - 6, ball.y, '#06b6d4', 20);

              if (p1ScoreRef.current >= targetScore) {
                handleVictory('p1');
              } else if (ballsRef.current.length === 0) {
                resetBall(2);
              }
              continue;
            }
          }
        }

        // 7. Update Particles
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const pt = particlesRef.current[i];
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.life -= dt;
          if (pt.life <= 0) {
            particlesRef.current.splice(i, 1);
          }
        }
      }

      // --- RENDERING PHASE ---

      // Render Obstacles
      obstaclesRef.current.forEach(obs => {
        ctx.fillStyle = level === 4 ? '#8b5cf6' : level === 5 ? '#f43f5e' : '#f59e0b';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      });

      // Render Power-ups
      powerUpsRef.current.forEach(pw => {
        ctx.beginPath();
        ctx.arc(pw.x, pw.y, pw.radius, 0, Math.PI * 2);
        ctx.fillStyle = pw.color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = '10px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pw.label, pw.x, pw.y);
      });

      // Render Lasers
      lasersRef.current.forEach(laser => {
        ctx.fillStyle = laser.player === 1 ? '#38bdf8' : '#f43f5e';
        ctx.fillRect(laser.x - 8, laser.y - 3, 16, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(laser.x - 4, laser.y - 1, 8, 2);
      });

      // Render Paddles
      // Player 1 Paddle
      const p1 = p1PaddleRef.current;
      const isP1Stunned = Date.now() < p1StunnedUntil;
      ctx.fillStyle = isP1Stunned ? '#64748b' : '#06b6d4';
      ctx.fillRect(24, p1.y, p1.w, p1.h);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(24, p1.y, p1.w, p1.h);
      // P1 Shield line
      if (p1HasShield) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(8, height);
        ctx.stroke();
      }

      // Player 2 Paddle
      const p2 = p2PaddleRef.current;
      const isP2Stunned = Date.now() < p2StunnedUntil;
      const p2X = width - 24 - p2.w;
      ctx.fillStyle = isP2Stunned ? '#64748b' : '#ec4899';
      ctx.fillRect(p2X, p2.y, p2.w, p2.h);
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 2;
      ctx.strokeRect(p2X, p2.y, p2.w, p2.h);
      // P2 Shield line (2P mode only)
      if (mode === '2p' && p2HasShield) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(width - 8, 0);
        ctx.lineTo(width - 8, height);
        ctx.stroke();
      }

      // Render Balls
      ballsRef.current.forEach(ball => {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 8-bit core highlight
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ball.x - 2, ball.y - 2, 4, 4);
      });

      // Render Particles
      particlesRef.current.forEach(pt => {
        const alpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
      });
      ctx.globalAlpha = 1.0;

      // Draw Retro Scoreboard on Top
      ctx.font = '28px "Press Start 2P", monospace';
      ctx.fillStyle = '#06b6d4';
      ctx.textAlign = 'center';
      ctx.fillText(String(p1ScoreRef.current), width * 0.25, 52);

      ctx.fillStyle = '#ec4899';
      ctx.fillText(String(p2ScoreRef.current), width * 0.75, 52);

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    animationFrameRef.current = animId;

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [
    isPlaying,
    isPaused,
    difficulty,
    mode,
    level,
    targetScore,
    powerupsEnabled,
    p1StunnedUntil,
    p2StunnedUntil,
    p1HasShield,
    p2HasShield,
    player1Gamepad,
    player2Gamepad,
    handleVictory,
    resetBall,
  ]);

  return (
    <div className="flex flex-col gap-2 sm:gap-3 w-full h-full min-h-0">
      {/* Top Game Control Header */}
      <div className="ark-game-bar shrink-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-slate-900 border border-slate-800 px-3 py-2 sm:p-3 rounded-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="ark-game-title font-arcade text-xs text-cyan-400">PONG PLUS</span>
            <span className="ark-hide-compact text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
              LEVEL {level}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => { setMode('1p'); setIsPlaying(false); }}
              className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition-all ${
                mode === '1p' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" /> 1P vs AI
            </button>
            <button
              onClick={() => { setMode('2p'); setIsPlaying(false); }}
              className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition-all ${
                mode === '2p' ? 'bg-fuchsia-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Swords className="w-3.5 h-3.5" /> 2P Local Arena
            </button>
          </div>
        </div>

        {/* Center / Stats HUD */}
        <div className="ark-hide-compact flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Rally:</span>
            <span className="text-amber-400 font-bold">{rallyCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Goal:</span>
            <span className="text-cyan-400 font-bold">{targetScore} pts</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {!isPlaying ? (
            <button
              onClick={startGame}
              className="retro-btn px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-arcade text-xs rounded font-bold flex items-center gap-2 shadow-lg cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> START MATCH
            </button>
          ) : (
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded font-medium flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          )}

          <button
            onClick={startGame}
            title="Restart Match"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded border border-slate-700 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsMuted(sound.toggleMute())}
            title={isMuted ? 'Unmute' : 'Mute'}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded border border-slate-700 cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>
        </div>
      </div>

      {/* Main Canvas Arena Container */}
      {/* Grows to the biggest 16:10 that fits the space, so nothing scrolls. */}
      <div className="flex-1 min-h-0 flex items-center justify-center" style={{ containerType: 'size' }}>
      <div className="relative aspect-[16/10] bg-slate-950 rounded-2xl border-2 border-cyan-500/30 overflow-hidden shadow-2xl crt-overlay" style={{ width: 'min(100cqw, 160cqh)' }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          className="w-full h-full object-contain block bg-slate-950"
        />

        {/* Start / Pause / Victory Overlays */}
        {!isPlaying && !winner && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="p-3 bg-cyan-950/50 rounded-2xl border border-cyan-500/40 mb-4 animate-pulse">
              <Zap className="w-10 h-10 text-cyan-400" />
            </div>
            <h2 className="font-arcade text-xl sm:text-2xl text-cyan-400 tracking-wider mb-2">
              PONG PLUS : ARENA
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-6">
              Experience the enhanced 8-bit classic with lasers, multi-ball capsules, moving gravity wells, and authentic gamepad integration!
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6 max-w-lg w-full text-left text-xs font-mono">
              <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
                <span className="text-cyan-400 font-bold block mb-0.5">Player 1</span>
                <span className="text-slate-400 text-[11px]">W / S or Left Stick</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
                <span className="text-fuchsia-400 font-bold block mb-0.5">Player 2</span>
                <span className="text-slate-400 text-[11px]">Up / Down or Pad 2</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
                <span className="text-amber-400 font-bold block mb-0.5">Laser Blaster</span>
                <span className="text-slate-400 text-[11px]">Spacebar / Button A</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
                <span className="text-emerald-400 font-bold block mb-0.5">Mobile Touch</span>
                <span className="text-slate-400 text-[11px]">Left/Right sliders</span>
              </div>
            </div>

            <button
              onClick={startGame}
              className="retro-btn px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-arcade text-sm rounded-lg font-bold shadow-xl hover:from-cyan-400 hover:to-blue-500 transition-all cursor-pointer"
            >
              INSERT COIN & PLAY
            </button>
          </div>
        )}

        {isPaused && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
            <h3 className="font-arcade text-2xl text-amber-400 mb-4 animate-bounce">GAME PAUSED</h3>
            <button
              onClick={() => setIsPaused(false)}
              className="px-6 py-2.5 bg-cyan-500 text-slate-950 font-arcade text-xs rounded font-bold cursor-pointer hover:bg-cyan-400"
            >
              RESUME PLAY
            </button>
          </div>
        )}

        {winner && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
            <Trophy className="w-14 h-14 text-yellow-400 mb-3 animate-bounce" />
            <h2 className="font-arcade text-xl sm:text-2xl text-yellow-400 mb-2">
              {winner === 'p1' ? 'PLAYER 1 WINS!' : mode === '2p' ? 'PLAYER 2 WINS!' : 'AI OVERDRIVE VICTORIOUS!'}
            </h2>
            <p className="text-xs font-mono text-slate-300 mb-1">
              Final Score: <span className="text-cyan-400">{p1Score}</span> - <span className="text-fuchsia-400">{p2Score}</span>
            </p>
            <p className="text-xs font-mono text-amber-400 mb-6">
              Peak Rally: {rallyCount} Consecutive Hits
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={startGame}
                className="retro-btn px-6 py-2.5 bg-cyan-500 text-slate-950 font-arcade text-xs rounded font-bold hover:bg-cyan-400 cursor-pointer"
              >
                REMATCH
              </button>
              <button
                onClick={() => setWinner(null)}
                className="px-5 py-2.5 bg-slate-800 text-slate-200 text-xs rounded font-medium border border-slate-700 hover:bg-slate-700 cursor-pointer"
              >
                LOBBY
              </button>
            </div>
          </div>
        )}

        {/* Mobile On-Screen Virtual Touch Zones */}
        <div className="absolute inset-y-0 left-0 w-24 sm:hidden flex flex-col justify-between p-2 pointer-events-auto select-none opacity-60 hover:opacity-100">
          <div 
            className="flex-1 bg-cyan-500/10 border-r border-cyan-500/30 rounded-r-lg flex items-center justify-center touch-none"
            onTouchStart={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              mobileP1TouchY.current = ((e.touches[0].clientY - rect.top) / rect.height) * 500;
            }}
            onTouchMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const touch = e.touches[0];
              mobileP1TouchY.current = ((touch.clientY - rect.top) / rect.height) * 500;
            }}
            onTouchEnd={() => { mobileP1TouchY.current = null; }}
          >
            <span className="font-arcade text-[9px] text-cyan-400 -rotate-90">P1 SLIDE</span>
          </div>
          {p1LaserCharges > 0 && (
            <button
              onClick={() => fireLaser(1)}
              className="mt-2 py-3 bg-red-600 text-white font-arcade text-[9px] rounded shadow-lg active:scale-95"
            >
              FIRE ({p1LaserCharges})
            </button>
          )}
        </div>

        {mode === '2p' && (
          <div className="absolute inset-y-0 right-0 w-24 sm:hidden flex flex-col justify-between p-2 pointer-events-auto select-none opacity-60 hover:opacity-100">
            <div 
              className="flex-1 bg-fuchsia-500/10 border-l border-fuchsia-500/30 rounded-l-lg flex items-center justify-center touch-none"
              onTouchStart={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                mobileP2TouchY.current = ((e.touches[0].clientY - rect.top) / rect.height) * 500;
              }}
              onTouchMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const touch = e.touches[0];
                mobileP2TouchY.current = ((touch.clientY - rect.top) / rect.height) * 500;
              }}
              onTouchEnd={() => { mobileP2TouchY.current = null; }}
            >
              <span className="font-arcade text-[9px] text-fuchsia-400 rotate-90">P2 SLIDE</span>
            </div>
            {p2LaserCharges > 0 && (
              <button
                onClick={() => fireLaser(2)}
                className="mt-2 py-3 bg-red-600 text-white font-arcade text-[9px] rounded shadow-lg active:scale-95"
              >
                FIRE ({p2LaserCharges})
              </button>
            )}
          </div>
        )}
      </div>

      </div>

      {/* Sub-bar Arena Options & Perks HUD (on short screens, only before a match) */}
      <div className={`ark-compact-row shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2 bg-slate-900 px-3 py-2 sm:p-3 rounded-xl border border-slate-800 text-xs ${compact && isPlaying ? 'hidden' : ''}`}>
        {/* P1 Perks */}
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm" />
          <span className="text-slate-300 font-medium">P1 Lasers:</span>
          <span className="font-mono text-cyan-400 font-bold">{p1LaserCharges}</span>
          {p1HasShield && <Shield className="w-3.5 h-3.5 text-blue-400" />}
        </div>

        {/* P2 Perks */}
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-fuchsia-400 shadow-sm" />
          <span className="text-slate-300 font-medium">{mode === '2p' ? 'P2 Lasers:' : 'AI Threat:'}</span>
          <span className="font-mono text-fuchsia-400 font-bold">
            {mode === '2p' ? p2LaserCharges : difficulty.toUpperCase()}
          </span>
          {mode === '2p' && p2HasShield && <Shield className="w-3.5 h-3.5 text-blue-400" />}
        </div>

        {/* Level selector */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Arena:</span>
          <select
            value={level}
            onChange={(e) => {
              const lvl = Number(e.target.value);
              setLevel(lvl);
              if (canvasRef.current) {
                setupLevelObstacles(lvl, canvasRef.current.width, canvasRef.current.height);
              }
            }}
            disabled={isPlaying}
            className="bg-slate-950 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs cursor-pointer"
          >
            <option value={1}>Lvl 1: Classic Neon</option>
            <option value={2}>Lvl 2: Asteroids</option>
            <option value={3}>Lvl 3: Warp Gates</option>
            <option value={4}>Lvl 4: Singularity</option>
            <option value={5}>Lvl 5: Overdrive Boss</option>
          </select>
        </div>

        {/* Powerups toggle */}
        <div className="flex items-center justify-end gap-2">
          <span className="text-slate-400">Power-ups:</span>
          <button
            onClick={() => setPowerupsEnabled(!powerupsEnabled)}
            className={`px-2 py-0.5 rounded text-xs font-mono border ${
              powerupsEnabled ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}
          >
            {powerupsEnabled ? 'ENABLED' : 'VANILLA'}
          </button>
        </div>
      </div>
    </div>
  );
};

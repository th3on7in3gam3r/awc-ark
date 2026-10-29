import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TIER_TUNING, type Tier } from '../lib/tiers';
import { GamepadState, HighScoreEntry } from '../types';
import { sound } from '../services/sound';
import { storage } from '../services/storage';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Heart } from 'lucide-react';

/**
 * Dove Defender — an original AWC Ark game.
 * A dove guards Noah's ark from swarms of locusts, beetles and moths. The swarm
 * sweeps in, settles into a swaying formation, then sends bugs diving at the dove.
 * Olive branches give a triple shot for a few seconds; a shield blocks one hit.
 */

interface DoveDefenderProps {
  /** Beginner / Intermediate / Advanced. */
  tier?: Tier;
  player1Gamepad: GamepadState | null;
  onScoreSaved?: (entry: HighScoreEntry) => void;
}

type BugKind = 'locust' | 'beetle' | 'moth';
type BugState = 'wait' | 'enter' | 'form' | 'dive' | 'return';

interface Bug {
  kind: BugKind;
  slotX: number;
  slotY: number;
  x: number;
  y: number;
  hp: number;
  state: BugState;
  t: number; // frames in current state
  delay: number; // frames before entering
  fromLeft: boolean;
  wobble: number;
  shotsLeft: number;
}

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Drop {
  x: number;
  y: number;
  kind: 'olive' | 'shield';
}

interface Burst {
  x: number;
  y: number;
  t: number;
  color: string;
}

const W = 800;
const H = 500;
const PX = 2.5; // size of one art pixel

// Original pixel art. Letters map to colors in PALETTE; '.' is empty.
const ART: Record<'dove' | BugKind, string[]> = {
  dove: [
    '......o......',
    '.....WWW.....',
    '.....WkW.....',
    'W....WWW....W',
    'WW..WWWWW..WW',
    'WWWWWWWWWWWWW',
    '.WWWWWWWWWWW.',
    '...WW.W.WW...',
    '....W...W....',
  ],
  locust: [
    '....d.d....',
    '.....g.....',
    '....ggg....',
    '..d.gyg.d..',
    '...ggggg...',
    '.d.gGgGg.d.',
    'd..gGgGg..d',
    '...gGgGg...',
    '..dgGgGgd..',
    '.d..ggg..d.',
    'd....g....d',
  ],
  beetle: [
    '...q...q...',
    '....qqq....',
    '.q.ppqpp.q.',
    '..plpqplp..',
    'q.pppqppp.q',
    '.qpppqpppq.',
    '..pppqppp..',
    '.q.ppqpp.q.',
    '....p.p....',
  ],
  moth: [
    '....b...b....',
    '.....bbb.....',
    'yy..byyyb..yy',
    'yyyybyyybyyyy',
    'yyyyyyyyyyyyy',
    '.yyyb...byyy.',
    '..yy.....yy..',
  ],
};

const PALETTE: Record<string, string> = {
  W: '#F8F4EA',
  o: '#F2A43A',
  k: '#1B1B2E',
  g: '#6CCB5F',
  d: '#2F7D32',
  y: '#F2D98A',
  b: '#8A5A3C',
  p: '#B07BE0',
  l: '#E3C8FF',
  q: '#5A3480',
  G: '#B5E58A',
};

const HURT_PALETTE: Record<string, string> = { ...PALETTE, p: '#E8A0B4', l: '#FFE0EA', y: '#F7B267' };

const POINTS: Record<BugKind, { form: number; dive: number; hp: number }> = {
  locust: { form: 50, dive: 100, hp: 1 },
  beetle: { form: 80, dive: 160, hp: 2 },
  moth: { form: 150, dive: 400, hp: 3 },
};

function artSize(rows: string[]) {
  return { w: rows[0].length * PX, h: rows.length * PX };
}

function drawArt(ctx: CanvasRenderingContext2D, rows: string[], cx: number, cy: number, palette = PALETTE, flap = 0) {
  const { w, h } = artSize(rows);
  const left = cx - w / 2;
  const top = cy - h / 2;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      // Wing tips (outer columns) flap up and down.
      const edge = c < 2 || c > row.length - 3 ? flap : 0;
      ctx.fillStyle = palette[ch] || '#fff';
      ctx.fillRect(left + c * PX, top + r * PX + edge, PX + 0.3, PX + 0.3);
    }
  }
}

function buildSwarm(wave: number): Bug[] {
  const rows: Array<{ kind: BugKind; count: number }> = [
    { kind: 'moth', count: Math.min(2 + Math.floor(wave / 2), 6) },
    { kind: 'beetle', count: 8 },
    { kind: 'beetle', count: wave >= 3 ? 8 : 6 },
    { kind: 'locust', count: 10 },
    { kind: 'locust', count: wave >= 2 ? 10 : 8 },
  ];
  const bugs: Bug[] = [];
  let order = 0;
  rows.forEach((row, r) => {
    const gap = 50;
    const startX = W / 2 - ((row.count - 1) * gap) / 2;
    for (let c = 0; c < row.count; c++) {
      const fromLeft = (r + (c < row.count / 2 ? 0 : 1)) % 2 === 0;
      bugs.push({
        kind: row.kind,
        slotX: startX + c * gap,
        slotY: 58 + r * 34,
        x: fromLeft ? -40 : W + 40,
        y: -30,
        hp: POINTS[row.kind].hp,
        state: 'wait',
        t: 0,
        delay: order * 5 + r * 18,
        fromLeft,
        wobble: Math.random() * Math.PI * 2,
        shotsLeft: 0,
      });
      order++;
    }
  });
  return bugs;
}

export const DoveDefender: React.FC<DoveDefenderProps> = ({ player1Gamepad, tier = 'intermediate', onScoreSaved }) => {
  const tune = TIER_TUNING[tier];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [lives, setLives] = useState(tune.lives);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isMuted, setIsMuted] = useState(sound.getMuted());

  const keys = useRef<Record<string, boolean>>({});
  const padRef = useRef<GamepadState | null>(player1Gamepad);
  padRef.current = player1Gamepad;
  const playingRef = useRef(false);
  const pausedRef = useRef(false);
  const gameOverRef = useRef(false);
  playingRef.current = isPlaying;
  pausedRef.current = isPaused;
  gameOverRef.current = gameOver;

  const g = useRef({
    frame: 0,
    doveX: W / 2,
    bugs: [] as Bug[],
    shots: [] as Shot[],
    enemyShots: [] as Shot[],
    drops: [] as Drop[],
    bursts: [] as Burst[],
    score: 0,
    wave: 1,
    lives: tune.lives,
    fireCooldown: 0,
    tripleUntil: 0,
    shield: false,
    invulnUntil: 0,
    nextDive: 180,
    sway: 0,
    waveBanner: 0,
    shotsFired: 0,
    hits: 0,
    dropToggle: false,
  });

  const endGame = useCallback(() => {
    const s = g.current;
    setGameOver(true);
    setIsPlaying(false);
    playingRef.current = false;
    sound.playGameOver();
    const entry = storage.addHighScore({
      gameId: 'dove-defender',
      playerName: 'AWC Dove',
      avatar: '🕊️',
      score: s.score,
      levelReached: s.wave,
      device: padRef.current?.connected ? 'Gamepad' : 'Keyboard',
      stats: { accuracy: s.shotsFired ? Math.round((s.hits / s.shotsFired) * 100) : 0 },
    });
    if (onScoreSaved) onScoreSaved(entry);
  }, [onScoreSaved]);

  const startGame = useCallback(() => {
    g.current = {
      frame: 0,
      doveX: W / 2,
      bugs: buildSwarm(1),
      shots: [],
      enemyShots: [],
      drops: [],
      bursts: [],
      score: 0,
      wave: 1,
      lives: tune.lives,
      fireCooldown: 0,
      tripleUntil: 0,
      shield: false,
      invulnUntil: 0,
      nextDive: 200,
      sway: 0,
      waveBanner: 120,
      shotsFired: 0,
      hits: 0,
      dropToggle: false,
    };
    setScore(0);
    setWave(1);
    setLives(tune.lives);
    setGameOver(false);
    setIsPaused(false);
    setIsPlaying(true);
    playingRef.current = true;
    sound.playScore();
  }, [tune.lives]);

  // Keyboard: arrows or A/D move, Space or Up fires (hold to keep firing).
  useEffect(() => {
    const isGameKey = (e: KeyboardEvent) =>
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code);
    const down = (e: KeyboardEvent) => {
      if (isGameKey(e)) e.preventDefault();
      keys.current[e.code] = true;
      keys.current[e.key.toLowerCase()] = true;
    };
    const up = (e: KeyboardEvent) => {
      if (isGameKey(e)) e.preventDefault();
      keys.current[e.code] = false;
      keys.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', down, { passive: false });
    window.addEventListener('keyup', up, { passive: false });
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

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

  // Game loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let animId = 0;

    const stars = Array.from({ length: 60 }, (_, i) => ({
      x: (i * 137.5) % W,
      y: (i * 71.3) % (H - 60),
      s: 0.6 + ((i * 13) % 10) / 10,
      v: 0.15 + ((i * 7) % 10) / 25,
    }));

    const burst = (x: number, y: number, color: string) => g.current.bursts.push({ x, y, t: 0, color });

    const hitDove = () => {
      const s = g.current;
      if (s.frame < s.invulnUntil) return;
      if (s.shield) {
        s.shield = false;
        s.invulnUntil = s.frame + 60;
        sound.playPaddleHit(300);
        return;
      }
      s.lives -= 1;
      setLives(s.lives);
      sound.playExplosion();
      burst(s.doveX, H - 70, '#F8F4EA');
      s.enemyShots = [];
      s.invulnUntil = s.frame + 120;
      if (s.lives <= 0) endGame();
    };

    const loop = () => {
      const s = g.current;
      const running = playingRef.current && !pausedRef.current;
      const doveY = H - 70;

      // --- Update ---
      if (running) {
        s.frame++;
        const pad = padRef.current;
        const k = keys.current;

        // Move
        let move = 0;
        if (k['ArrowLeft'] || k['a']) move -= 1;
        if (k['ArrowRight'] || k['d']) move += 1;
        if (pad?.connected) {
          if (pad.buttons.left || pad.axes[0] < -0.3) move = -1;
          if (pad.buttons.right || pad.axes[0] > 0.3) move = 1;
        }
        s.doveX = Math.max(24, Math.min(W - 24, s.doveX + move * 6));

        // Fire (hold to keep firing)
        const firing = k['Space'] || k['ArrowUp'] || !!pad?.buttons.a;
        if (s.fireCooldown > 0) s.fireCooldown--;
        const triple = s.frame < s.tripleUntil;
        const maxShots = triple ? 9 : 3;
        if (firing && s.fireCooldown === 0 && s.shots.length < maxShots) {
          const spreads = triple ? [-2.2, 0, 2.2] : [0];
          for (const vx of spreads) s.shots.push({ x: s.doveX, y: doveY - 14, vx, vy: -10 });
          s.shotsFired++;
          s.fireCooldown = 14;
          sound.playLaser();
        }

        // Formation sways gently, faster in later waves.
        s.sway = Math.sin(s.frame / 70) * (28 + Math.min(s.wave, 6) * 3);
        const speed = tune.alienSpeed * (1 + (s.wave - 1) * 0.08);

        // Bugs
        const formed = s.bugs.filter((b) => b.state === 'form');
        for (const b of s.bugs) {
          b.t++;
          const tx = b.slotX + s.sway;
          const ty = b.slotY;
          if (b.state === 'wait') {
            if (b.t >= b.delay) {
              b.state = 'enter';
              b.t = 0;
            }
          } else if (b.state === 'enter') {
            // Swoop in along a curve from the top corner to its place.
            const dur = 100 / speed;
            const p = Math.min(1, b.t / dur);
            const sx = b.fromLeft ? -40 : W + 40;
            const sy = -30;
            const cx = b.fromLeft ? W * 0.75 : W * 0.25;
            const cy = H * 0.55;
            const q = 1 - p;
            b.x = q * q * sx + 2 * q * p * cx + p * p * tx;
            b.y = q * q * sy + 2 * q * p * cy + p * p * ty;
            if (p >= 1) {
              b.state = 'form';
              b.t = 0;
            }
          } else if (b.state === 'form') {
            b.x = tx;
            b.y = ty;
            // A rare shot from the formation
            if (Math.random() < tune.alienFireChance * 0.08) {
              s.enemyShots.push({ x: b.x, y: b.y + 10, vx: 0, vy: tune.alienShotSpeed * 0.8 });
            }
          } else if (b.state === 'dive') {
            const toward = Math.max(-2.4, Math.min(2.4, (s.doveX - b.x) * 0.03));
            b.x += toward * speed + Math.sin(b.t / 9 + b.wobble) * 2.2;
            b.y += (2.4 + (b.kind === 'moth' ? 0.4 : 0)) * speed;
            if (b.shotsLeft > 0 && b.y > 120 && b.y < H - 160 && Math.random() < tune.alienFireChance * 0.9) {
              b.shotsLeft--;
              const aim = Math.max(-1.5, Math.min(1.5, (s.doveX - b.x) / 120));
              s.enemyShots.push({ x: b.x, y: b.y + 10, vx: aim, vy: tune.alienShotSpeed });
            }
            // Ran into the dove
            if (Math.abs(b.x - s.doveX) < 26 && Math.abs(b.y - doveY) < 18) {
              b.hp = 0;
              burst(b.x, b.y, PALETTE.g);
              hitDove();
            }
            if (b.y > H + 30) {
              b.state = 'return';
              b.t = 0;
              b.x = tx;
              b.y = -30;
            }
          } else if (b.state === 'return') {
            b.x += (tx - b.x) * 0.08;
            b.y += (ty - b.y) * 0.06;
            if (Math.abs(b.y - ty) < 1.5) {
              b.state = 'form';
              b.t = 0;
            }
          }
        }

        // Send a bug (sometimes with a buddy) diving.
        s.nextDive--;
        if (s.nextDive <= 0 && formed.length) {
          const leader = formed[Math.floor(Math.random() * formed.length)];
          const divers = [leader];
          if (leader.kind === 'moth') {
            const buddies = formed.filter((b) => b !== leader && b.kind === 'beetle' && Math.abs(b.slotX - leader.slotX) < 80);
            divers.push(...buddies.slice(0, 2));
          }
          for (const d of divers) {
            d.state = 'dive';
            d.t = 0;
            d.shotsLeft = 1 + Math.floor(Math.random() * (1 + Math.min(s.wave, 4) / 2));
          }
          sound.playPaddleHit(520);
          const base = Math.max(45, 150 - s.wave * 10) / tune.alienSpeed;
          s.nextDive = base + Math.random() * base;
        }

        // Dove shots
        for (let i = s.shots.length - 1; i >= 0; i--) {
          const sh = s.shots[i];
          sh.x += sh.vx;
          sh.y += sh.vy;
          let hit = false;
          for (const b of s.bugs) {
            if (b.hp <= 0 || b.state === 'wait') continue;
            const half = b.kind === 'moth' ? 17 : 14;
            if (Math.abs(sh.x - b.x) < half && Math.abs(sh.y - b.y) < 13) {
              hit = true;
              s.hits++;
              b.hp--;
              if (b.hp <= 0) {
                const diving = b.state === 'dive';
                const pts = diving ? POINTS[b.kind].dive : POINTS[b.kind].form;
                s.score += pts;
                setScore(s.score);
                burst(b.x, b.y, b.kind === 'moth' ? PALETTE.y : b.kind === 'beetle' ? PALETTE.p : PALETTE.g);
                sound.playPaddleHit(diving ? 1000 : 800);
                // Moths always leave a gift; other bugs sometimes do.
                if (b.kind === 'moth' || Math.random() < 0.04) {
                  s.dropToggle = !s.dropToggle;
                  s.drops.push({ x: b.x, y: b.y, kind: s.dropToggle ? 'olive' : 'shield' });
                }
              } else {
                sound.playPaddleHit(400);
              }
              break;
            }
          }
          if (hit || sh.y < -10 || sh.x < -10 || sh.x > W + 10) s.shots.splice(i, 1);
        }
        s.bugs = s.bugs.filter((b) => b.hp > 0);

        // Enemy shots
        for (let i = s.enemyShots.length - 1; i >= 0; i--) {
          const es = s.enemyShots[i];
          es.x += es.vx;
          es.y += es.vy;
          if (Math.abs(es.x - s.doveX) < 15 && Math.abs(es.y - doveY) < 12) {
            s.enemyShots.splice(i, 1);
            // A hit can clear every shot, so stop walking this list for this frame.
            hitDove();
            break;
          }
          if (es.y > H) s.enemyShots.splice(i, 1);
        }

        // Gifts
        for (let i = s.drops.length - 1; i >= 0; i--) {
          const d = s.drops[i];
          d.y += 2;
          if (Math.abs(d.x - s.doveX) < 24 && Math.abs(d.y - doveY) < 20) {
            if (d.kind === 'olive') s.tripleUntil = s.frame + 60 * 8;
            else s.shield = true;
            sound.playScore();
            s.drops.splice(i, 1);
            continue;
          }
          if (d.y > H) s.drops.splice(i, 1);
        }

        // Wave cleared
        if (s.bugs.length === 0 && playingRef.current) {
          s.score += s.wave * 200;
          setScore(s.score);
          s.wave++;
          setWave(s.wave);
          s.bugs = buildSwarm(s.wave);
          s.enemyShots = [];
          s.nextDive = 200;
          s.waveBanner = 120;
          sound.playVictory();
        }
        if (s.waveBanner > 0) s.waveBanner--;
      }

      // --- Draw ---
      ctx.fillStyle = '#0B0A1F';
      ctx.fillRect(0, 0, W, H);
      for (const st of stars) {
        if (running) st.y = (st.y + st.v) % (H - 60);
        ctx.fillStyle = `rgba(248,244,234,${0.35 + 0.4 * Math.abs(Math.sin((s.frame + st.x) / 50))})`;
        ctx.fillRect(st.x, st.y, st.s, st.s);
      }

      // The ark at the bottom
      ctx.fillStyle = '#5B3A24';
      ctx.beginPath();
      ctx.moveTo(150, H - 30);
      ctx.lineTo(W - 150, H - 30);
      ctx.lineTo(W - 200, H);
      ctx.lineTo(200, H);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#7B5233';
      ctx.fillRect(300, H - 46, 200, 16);
      ctx.fillStyle = '#4A2F1C';
      ctx.fillRect(280, H - 52, 240, 6);
      ctx.fillStyle = '#F2D98A';
      for (let wx = 320; wx < 490; wx += 34) ctx.fillRect(wx, H - 42, 10, 7);
      ctx.fillStyle = '#1E3A5F';
      ctx.fillRect(0, H - 6, W, 6);

      const flap = Math.floor(s.frame / 12) % 2 === 0 ? 0 : -2;
      for (const b of s.bugs) {
        if (b.state === 'wait') continue;
        const hurt = b.hp < POINTS[b.kind].hp;
        drawArt(ctx, ART[b.kind], b.x, b.y, hurt ? HURT_PALETTE : PALETTE, flap);
      }

      // Gifts
      for (const d of s.drops) {
        if (d.kind === 'olive') {
          ctx.strokeStyle = '#8BC34A';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(d.x - 10, d.y + 6);
          ctx.quadraticCurveTo(d.x, d.y - 8, d.x + 10, d.y - 4);
          ctx.stroke();
          ctx.fillStyle = '#6CCB5F';
          ctx.fillRect(d.x - 6, d.y - 2, 5, 4);
          ctx.fillRect(d.x + 2, d.y - 6, 5, 4);
          ctx.fillStyle = '#556B2F';
          ctx.fillRect(d.x + 6, d.y - 1, 4, 4);
        } else {
          ctx.strokeStyle = '#7DE3D0';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(d.x, d.y, 9, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#7DE3D0';
          ctx.fillRect(d.x - 1.5, d.y - 5, 3, 10);
          ctx.fillRect(d.x - 5, d.y - 1.5, 10, 3);
        }
      }

      // Dove
      if (playingRef.current || !gameOverRef.current) {
        const blink = s.frame < s.invulnUntil && Math.floor(s.frame / 6) % 2 === 0;
        if (!blink) drawArt(ctx, ART.dove, s.doveX, doveY, PALETTE, flap);
        if (s.shield) {
          ctx.strokeStyle = 'rgba(125,227,208,0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(s.doveX, doveY, 26, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Shots
      ctx.fillStyle = s.frame < s.tripleUntil ? '#B5E58A' : '#F8F4EA';
      for (const sh of s.shots) ctx.fillRect(sh.x - 1.5, sh.y - 6, 3, 10);
      ctx.fillStyle = '#E8A0B4';
      for (const es of s.enemyShots) {
        ctx.fillRect(es.x - 2, es.y - 4, 4, 8);
      }

      // Bursts
      for (let i = s.bursts.length - 1; i >= 0; i--) {
        const bu = s.bursts[i];
        bu.t++;
        ctx.fillStyle = bu.color;
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          ctx.fillRect(bu.x + Math.cos(ang) * bu.t * 1.6 - 1.5, bu.y + Math.sin(ang) * bu.t * 1.6 - 1.5, 3, 3);
        }
        if (bu.t > 22) s.bursts.splice(i, 1);
      }

      // Olive branch timer
      if (running && s.frame < s.tripleUntil) {
        const left = (s.tripleUntil - s.frame) / (60 * 8);
        ctx.fillStyle = 'rgba(139,195,74,0.25)';
        ctx.fillRect(16, H - 18, 120, 6);
        ctx.fillStyle = '#8BC34A';
        ctx.fillRect(16, H - 18, 120 * left, 6);
      }

      // Wave banner
      if (playingRef.current && s.waveBanner > 0) {
        ctx.fillStyle = 'rgba(242,217,138,0.95)';
        ctx.font = '20px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`WAVE ${s.wave}`, W / 2, H / 2);
        ctx.textAlign = 'start';
      }

      // Start screen
      if (!playingRef.current && !gameOverRef.current) {
        drawArt(ctx, ART.dove, W / 2, H / 2 - 70, PALETTE, flap);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#F2D98A';
        ctx.font = '22px "Press Start 2P", monospace';
        ctx.fillText('DOVE DEFENDER', W / 2, H / 2);
        ctx.fillStyle = '#F8F4EA';
        ctx.font = '11px "Press Start 2P", monospace';
        ctx.fillText('Guard the ark from the swarm!', W / 2, H / 2 + 36);
        ctx.fillText('Move: arrows   Fire: Space', W / 2, H / 2 + 60);
        ctx.fillStyle = '#7DE3D0';
        ctx.fillText('Press Space or A to fly', W / 2, H / 2 + 92);
        ctx.textAlign = 'start';
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [endGame, tune.alienFireChance, tune.alienShotSpeed, tune.alienSpeed]);

  return (
    <div className="flex flex-col gap-2 sm:gap-3 w-full h-full min-h-0">
      <div className="ark-game-bar shrink-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-slate-900 border border-slate-800 px-3 py-2 sm:p-3 rounded-xl">
        <div className="flex items-center gap-3">
          <span className="ark-game-title font-arcade text-xs text-amber-300">DOVE DEFENDER</span>
          <span className="text-xs px-2 py-0.5 rounded bg-amber-950 text-amber-200 border border-amber-800 font-mono">
            WAVE {wave}
          </span>
          <div className="flex items-center gap-1" aria-label={`${lives} lives left`}>
            {Array.from({ length: tune.lives }).map((_, i) => (
              <Heart key={i} className={`w-4 h-4 ${i < lives ? 'text-rose-300 fill-rose-300' : 'text-slate-700'}`} />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-slate-400">
            Score: <strong className="text-amber-300 text-sm">{score}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isPlaying ? (
            <button
              onClick={startGame}
              className="retro-btn px-4 py-1.5 bg-amber-300 hover:bg-amber-200 text-slate-950 font-arcade text-xs rounded font-bold cursor-pointer"
            >
              FLY
            </button>
          ) : (
            <button
              onClick={() => setIsPaused(!isPaused)}
              aria-label={isPaused ? 'Resume' : 'Pause'}
              className="px-3 py-1.5 bg-slate-800 text-slate-200 text-xs rounded cursor-pointer"
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            onClick={startGame}
            aria-label="Restart"
            className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMuted(sound.toggleMute())}
            aria-label={isMuted ? 'Sound on' : 'Sound off'}
            className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-amber-300" />}
          </button>
        </div>
      </div>

      {/* Grows to the biggest 16:10 that fits the space, so nothing scrolls. */}
      <div className="flex-1 min-h-0 flex items-center justify-center" style={{ containerType: 'size' }}>
        <div
          className="relative aspect-[16/10] bg-slate-950 rounded-2xl border-2 border-amber-300/30 overflow-hidden shadow-2xl crt-overlay"
          style={{ width: 'min(100cqw, 160cqh)' }}
        >
          <canvas ref={canvasRef} width={W} height={H} className="w-full h-full object-contain block bg-slate-950" />

          {gameOver && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
              <h2 className="font-arcade text-xl text-amber-300 mb-2">THE SWARM GOT THROUGH</h2>
              <p className="text-sm font-mono text-slate-300 mb-1">Final Score: {score}</p>
              <p className="text-xs font-mono text-slate-400 mb-6">You reached wave {wave}</p>
              <button
                onClick={startGame}
                className="retro-btn px-6 py-2.5 bg-amber-300 text-slate-950 font-arcade text-xs rounded font-bold cursor-pointer"
              >
                FLY AGAIN
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

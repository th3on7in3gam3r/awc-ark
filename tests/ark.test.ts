import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseRoute } from '../src/lib/route';
import { gameFromPrototypeId, GAMES, formatScore } from '../src/lib/games';

test('routes', () => {
  assert.deepEqual(parseRoute('#/play/tetris'), { name: 'play', game: 'tetris' });
  assert.deepEqual(parseRoute('#/board/pong'), { name: 'board', game: 'pong' });
  assert.deepEqual(parseRoute('#/play/chess'), { name: 'home' });
  assert.deepEqual(parseRoute(''), { name: 'home' });
});

test('every game maps from the prototype id it reports', () => {
  assert.equal(gameFromPrototypeId('pong-plus'), 'pong');
  assert.equal(gameFromPrototypeId('space-invaders'), 'invaders');
  assert.equal(gameFromPrototypeId('tetris'), 'tetris');
  assert.equal(gameFromPrototypeId('breakout'), 'breakout');
  assert.equal(GAMES.length, 4);
  assert.equal(formatScore(16920), '16,920');
});

test('prototype leftovers are gone', () => {
  for (const f of ['PongPlus', 'Breakout', 'SpaceInvaders', 'Tetris']) {
    const src = readFileSync(`src/games/${f}.tsx`, 'utf8');
    assert.equal(/onRequestScoreSubmission\b(?!\?)/.test(src.replace(/onRequestScoreSubmission\?:.*\n/, '')), false, `${f} submit button`);
    assert.equal(/team: '/.test(src), false, `${f} fake team`);
    assert.equal(/wager/i.test(src), false, `${f} wagering`);
  }
  const pong = readFileSync('src/games/PongPlus.tsx', 'utf8');
  assert.match(pong, /twoPlayer: mode === '2p'/);
});

test('Tetris has thumb-sized controls', () => {
  const src = readFileSync('src/games/Tetris.tsx', 'utf8');
  assert.match(src, /aria-label="Rotate"/);
  assert.match(src, /h-16 rounded-2xl/);
  assert.match(src, /swipeRef/);
});

test('served under /ark so it shares the AWC Connect sign-in', () => {
  assert.match(readFileSync('vite.config.ts', 'utf8'), /base: '\/ark\/'/);
  const v = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.equal(v.outputDirectory, 'dist');
});

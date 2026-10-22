import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isTier, TIER_INFO, TIER_TUNING, TIERS } from '../src/lib/tiers';
import { PAD_LAYOUTS } from '../src/services/touchPad';
import { padDrawnHeight } from '../src/screens/TouchPad';

test('three tiers, Intermediate is the classic game', () => {
  assert.deepEqual([...TIERS], ['beginner', 'intermediate', 'advanced']);
  const mid = TIER_TUNING.intermediate;
  assert.equal(mid.alienSpeed, 1);
  assert.equal(mid.ballSpeed, 1);
  assert.equal(mid.paddleWidth, 90);
  assert.equal(mid.lives, 3);
  assert.equal(mid.dropTime, 1);
  assert.equal(mid.pongAi, 'medium');
  assert.equal(isTier('expert'), false);
});

test('Beginner is gentler and Advanced is tougher in every game', () => {
  const [b, m, a] = TIERS.map((t) => TIER_TUNING[t]);
  assert.ok(b.alienSpeed < m.alienSpeed && m.alienSpeed < a.alienSpeed);
  assert.ok(b.alienFireChance < m.alienFireChance && m.alienFireChance < a.alienFireChance);
  assert.ok(b.ballSpeed < m.ballSpeed && m.ballSpeed < a.ballSpeed);
  assert.ok(b.paddleWidth > m.paddleWidth && m.paddleWidth > a.paddleWidth);
  assert.ok(b.dropTime > m.dropTime && m.dropTime > a.dropTime);
  assert.ok(b.lives >= m.lives);
  assert.deepEqual(TIERS.map((t) => TIER_INFO[t].code), [1, 2, 3]);
});

test('every game takes the tier, and scores record it', () => {
  for (const f of ['SpaceInvaders', 'Breakout', 'PongPlus', 'Tetris']) {
    assert.match(readFileSync(`src/games/${f}.tsx`, 'utf8'), /const tune = TIER_TUNING\[tier\];/, f);
  }
  const play = readFileSync('src/screens/Play.tsx', 'utf8');
  assert.match(play, /stats: Record<string, number> = \{ tier: TIER_INFO\[tierRef\.current\]\.code \}/);
  assert.match(play, /key=\{`\$\{run\}-\$\{tier\}`\} tier=\{tier\}/);
});

test("Pong's tall up/down pad gets a bar tall enough that it can't overlap", () => {
  assert.equal(padDrawnHeight(PAD_LAYOUTS.pong, 100), 135);
  assert.equal(padDrawnHeight(PAD_LAYOUTS.breakout, 100), 100);
  assert.equal(padDrawnHeight(PAD_LAYOUTS.tetris, 100), 100);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { GAMES } from '../src/lib/games';
import { directionAt, PAD_LAYOUTS, shouldShowPad } from '../src/services/touchPad';

test('pad shows on touch screens, hides on computers, and remembers a choice', () => {
  assert.equal(shouldShowPad(null, true), true);
  assert.equal(shouldShowPad(null, false), false);
  assert.equal(shouldShowPad('on', false), true);
  assert.equal(shouldShowPad('off', true), false);
});

test('D-pad reads the direction under the thumb, with a small dead zone', () => {
  const all = ['up', 'down', 'left', 'right'] as const;
  assert.equal(directionAt(100, 100, 200, all), null);
  assert.equal(directionAt(190, 100, 200, all), 'right');
  assert.equal(directionAt(10, 100, 200, all), 'left');
  assert.equal(directionAt(100, 10, 200, all), 'up');
  assert.equal(directionAt(100, 190, 200, all), 'down');
});

test('left/right games treat the whole pad as left or right, so sliding never stalls', () => {
  const lr = ['left', 'right'] as const;
  assert.equal(directionAt(150, 5, 200, lr), 'right');
  assert.equal(directionAt(60, 195, 200, lr), 'left');
  const ud = ['up', 'down'] as const;
  assert.equal(directionAt(195, 60, 200, ud), 'up');
});

test('every game has a pad layout that uses its keyboard controls', () => {
  for (const g of GAMES) {
    const l = PAD_LAYOUTS[g];
    assert.ok(l.directions.length >= 2, g);
    for (const d of l.directions) assert.ok(l.keys[d], `${g} ${d}`);
    assert.ok(l.buttons.some((b) => b.id === 'a'), g);
  }
  // Pong player 1 is W/S: the arrows belong to player 2 in 2-player mode.
  assert.equal(PAD_LAYOUTS.pong.keys.up?.key, 'w');
  assert.equal(PAD_LAYOUTS.invaders.buttons[0].press.code, 'Space');
  assert.ok(PAD_LAYOUTS.invaders.buttons[0].repeatMs, 'holding fire keeps firing');
});

test('games fit the screen instead of scrolling', () => {
  const play = readFileSync('src/screens/Play.tsx', 'utf8');
  assert.match(play, /ark-fit/);
  for (const f of ['SpaceInvaders', 'Breakout', 'PongPlus']) {
    const src = readFileSync(`src/games/${f}.tsx`, 'utf8');
    assert.match(src, /width: 'min\(100cqw, 160cqh\)'/, f);
    assert.doesNotMatch(src, /max-h-\[5[48]0px\]/, f);
  }
  // The old Space Invaders strip moved the cannon when you pressed FIRE.
  assert.doesNotMatch(readFileSync('src/games/SpaceInvaders.tsx', 'utf8'), /SLIDE CANNON/);
});

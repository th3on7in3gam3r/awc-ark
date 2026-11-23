import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COLUMNS, ROWS, MAX_SCORE, newSnakeRun, stepSnake } from '../src/games/neonSnakeLogic';

test('one orb adds one point and one segment', () => {
  const run = { ...newSnakeRun(() => 0), food: { x: 11, y: 9 } };
  const next = stepSnake(run, 'right', () => 0);
  assert.equal(next.score, 1);
  assert.equal(next.body.length, 5);
  assert.deepEqual(next.food, { x: 0, y: 0 });
});

test('reversals are ignored and walls end the round', () => {
  const run = newSnakeRun(() => 0);
  const next = stepSnake(run, 'left');
  assert.equal(next.direction, 'right');
  assert.deepEqual(next.body[0], { x: 11, y: 9 });
  const ended = stepSnake({ ...run, body: [{ x: COLUMNS - 1, y: 0 }] }, 'right');
  assert.equal(ended.ended, true);
  assert.equal(stepSnake(ended, 'down'), ended);
});

test('the old tail square is safe unless the snake grows', () => {
  const run = {
    ...newSnakeRun(() => 0), direction: 'up' as const,
    body: [{ x: 3, y: 3 }, { x: 3, y: 4 }, { x: 2, y: 4 }, { x: 2, y: 3 }],
  };
  assert.equal(stepSnake(run, 'left').ended, false);
  assert.equal(stepSnake({ ...run, food: { x: 2, y: 3 } }, 'left').ended, true);
});

test('filling the board ends the round at the score ceiling', () => {
  const body = [{ x: 1, y: 0 }];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLUMNS; x++) {
      if (y !== 0 || x > 1) body.push({ x, y });
    }
  }
  const next = stepSnake({
    body, food: { x: 0, y: 0 }, score: MAX_SCORE - 1, direction: 'left', ended: false,
  }, 'left');
  assert.equal(next.food, null);
  assert.equal(next.ended, true);
  assert.equal(next.score, MAX_SCORE);
});

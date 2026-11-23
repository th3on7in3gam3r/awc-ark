import type { GamepadState } from '../types';

export const COLUMNS = 24;
export const ROWS = 18;
export const MAX_SCORE = COLUMNS * ROWS - 4;

export const directions = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
export type Direction = keyof typeof directions;
export function readSnakeController(pad: GamepadState | null): { direction: Direction | null; action: boolean } {
  if (!pad?.connected) return { direction: null, action: false };
  const { buttons, axes: [x, y] } = pad;
  let direction: Direction | null = null;
  if (buttons.up) direction = 'up';
  else if (buttons.down) direction = 'down';
  else if (buttons.left) direction = 'left';
  else if (buttons.right) direction = 'right';
  else if (Math.max(Math.abs(x), Math.abs(y)) > 0.5) {
    direction = Math.abs(x) > Math.abs(y) ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'up' : 'down');
  }
  return { direction, action: buttons.start || buttons.a };
}

type Cell = { x: number; y: number };
export type SnakeRun = {
  body: Cell[];
  food: Cell | null;
  direction: Direction;
  score: number;
  ended: boolean;
};

const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

function placeFood(body: Cell[], random: () => number): Cell | null {
  const cells: Cell[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLUMNS; x++) {
      const cell = { x, y };
      if (!body.some((segment) => sameCell(segment, cell))) cells.push(cell);
    }
  }
  return cells[Math.floor(random() * cells.length)] ?? null;
}

export function newSnakeRun(random = Math.random): SnakeRun {
  const body = [10, 9, 8, 7].map((x) => ({ x, y: 9 }));
  return { body, food: placeFood(body, random), direction: 'right', score: 0, ended: false };
}

export function stepSnake(run: SnakeRun, requested: Direction, random = Math.random): SnakeRun {
  if (run.ended) return run;
  const move = directions[requested];
  const old = directions[run.direction];
  const reversal = move.x === -old.x && move.y === -old.y;
  const direction = reversal ? run.direction : requested;
  const delta = directions[direction];
  const head = { x: run.body[0].x + delta.x, y: run.body[0].y + delta.y };
  const eating = run.food !== null && sameCell(head, run.food);
  const remaining = eating ? run.body : run.body.slice(0, -1);
  if (head.x < 0 || head.y < 0 || head.x >= COLUMNS || head.y >= ROWS || remaining.some((cell) => sameCell(head, cell))) {
    return { ...run, direction, ended: true };
  }
  const body = [head, ...remaining];
  const food = eating ? placeFood(body, random) : run.food;
  return { body, food, direction, score: run.score + Number(eating), ended: food === null };
}

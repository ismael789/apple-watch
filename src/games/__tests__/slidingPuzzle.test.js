/* eslint-env jest */

import {
  createPuzzle,
  isPuzzleSolvable,
  isPuzzleSolved,
  movePuzzleLine,
  pausePuzzle,
  movePuzzle,
  playPuzzle,
  resumePuzzle,
  shufflePuzzle,
  solvedBoard,
  startPuzzle,
  createPuzzleSetup,
} from '../slidingPuzzle';

describe('NumPuz clásico', () => {
  test.each([3, 4, 5, 6])(
    'genera tableros %sx%s solucionables y no resueltos',
    size => {
      let seed = 7;
      const random = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
      const board = shufflePuzzle(size, size * size * 30, random);
      expect(isPuzzleSolvable(board, size)).toBe(true);
      expect(isPuzzleSolved(board, size)).toBe(false);
    },
  );

  test('solo permite piezas ortogonalmente adyacentes', () => {
    const board = solvedBoard(3);
    expect(movePuzzle(board, 3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7, 0, 8]);
    expect(movePuzzle(board, 3, 4)).toBe(board);
    expect(movePuzzle(board, 3, 6)).toBe(board);
  });

  test('desplaza varias fichas alineadas hacia el espacio', () => {
    const board = solvedBoard(4);
    expect(movePuzzleLine(board, 4, 12)).toEqual([
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      0,
      13,
      14,
      15,
    ]);
    expect(movePuzzleLine(board, 4, 3)).toEqual([
      1,
      2,
      3,
      0,
      5,
      6,
      7,
      4,
      9,
      10,
      11,
      8,
      13,
      14,
      15,
      12,
    ]);
    expect(movePuzzleLine(board, 4, 10)).toBe(board);
  });

  test('la preparación, pausa y continuación conservan la partida', () => {
    const setup = createPuzzleSetup(6);
    expect(setup.board).toEqual(solvedBoard(6));
    expect(setup.status).toBe('ready');
    const started = startPuzzle(setup, () => 0.25);
    expect(started.status).toBe('playing');
    expect(isPuzzleSolvable(started.board, 6)).toBe(true);
    const paused = pausePuzzle(started);
    expect(paused.status).toBe('paused');
    expect(resumePuzzle(paused).status).toBe('playing');
  });

  test('detecta la solución exacta y conserva movimientos al restaurar', () => {
    const restored = JSON.parse(
      JSON.stringify({
        ...createPuzzle(3),
        board: [1, 2, 3, 4, 5, 6, 7, 0, 8],
        moves: 11,
        startedAt: Date.now(),
      }),
    );
    const finished = playPuzzle(restored, 8);
    expect(finished.status).toBe('won');
    expect(finished.moves).toBe(12);
    expect(isPuzzleSolved(finished.board, 3)).toBe(true);
  });
});

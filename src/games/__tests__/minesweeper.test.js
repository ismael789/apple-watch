/* eslint-env jest */

import {
  chordCell,
  countFlags,
  createMinesweeper,
  placeMines,
  revealCell,
  toggleFlag,
} from '../minesweeper';

const knownGame = () => {
  const game = createMinesweeper(3, 3, 1);
  const cells = game.cells.map((cell, index) => ({
    ...cell,
    mine: index === 0,
    adjacent: [1, 3, 4].includes(index) ? 1 : 0,
  }));
  return { ...game, cells, generated: true, status: 'playing', startedAt: 1 };
};

describe('Buscaminas clásico', () => {
  test('genera exactamente las minas y protege la primera apertura y vecinos', () => {
    const game = placeMines(createMinesweeper(6, 6, 6), 14, () => 0);
    expect(game.cells.filter(cell => cell.mine)).toHaveLength(6);
    [7, 8, 9, 13, 14, 15, 19, 20, 21].forEach(index => {
      expect(game.cells[index].mine).toBe(false);
    });
  });

  test('calcula números y expande ceros sin atravesar banderas', () => {
    let game = knownGame();
    game = toggleFlag(game, 6);
    game = revealCell(game, 8);
    expect(game.cells[1].adjacent).toBe(1);
    expect(game.cells[8].revealed).toBe(true);
    expect(game.cells[6].revealed).toBe(false);
    expect(countFlags(game)).toBe(1);
  });

  test('las banderas permiten chord y una bandera incorrecta puede causar derrota', () => {
    let correct = knownGame();
    correct = toggleFlag(correct, 0);
    correct = revealCell(correct, 1);
    correct = chordCell(correct, 1);
    expect(correct.cells[2].revealed).toBe(true);

    let wrong = knownGame();
    wrong = toggleFlag(wrong, 2);
    wrong = revealCell(wrong, 1);
    wrong = chordCell(wrong, 1);
    expect(wrong.status).toBe('lost');
    expect(wrong.cells[0].exploded).toBe(true);
    expect(wrong.cells[2].wrongFlag).toBe(true);
  });

  test('solo gana al revelar todas las casillas seguras', () => {
    let game = knownGame();
    game = toggleFlag(game, 0);
    expect(game.status).toBe('playing');
    game = revealCell(game, 8);
    expect(game.status).toBe('won');
  });
});

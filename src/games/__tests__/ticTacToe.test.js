/* eslint-env jest */

import {
  WIN_LINES,
  createTicTacToe,
  nextTicTacToeRound,
  playTicTacToe,
} from '../ticTacToe';

describe('Gato clásico', () => {
  test.each(WIN_LINES.map(line => [line]))(
    'detecta la línea ganadora %p',
    line => {
      let game = createTicTacToe();
      const other = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(
        index => !line.includes(index),
      );
      game = playTicTacToe(game, line[0]);
      game = playTicTacToe(game, other[0]);
      game = playTicTacToe(game, line[1]);
      game = playTicTacToe(game, other[1]);
      game = playTicTacToe(game, line[2]);
      expect(game.winner).toBe('X');
      expect(game.winningLine).toEqual(line);
      expect(playTicTacToe(game, other[2])).toBe(game);
    },
  );

  test('detecta empate, bloquea casillas ocupadas y alterna el inicio', () => {
    let game = createTicTacToe();
    [0, 1, 2, 4, 3, 5, 7, 6, 8].forEach(index => {
      game = playTicTacToe(game, index);
    });
    expect(game.draw).toBe(true);
    expect(game.scores.draws).toBe(1);
    const next = nextTicTacToeRound(game);
    expect(next.turn).toBe('O');
    const occupied = playTicTacToe(next, 0);
    expect(playTicTacToe(occupied, 0)).toBe(occupied);
  });
});

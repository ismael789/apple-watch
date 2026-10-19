export const WIN_LINES = Object.freeze([
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]);

export const createTicTacToe = (starter = 'X', scores = null) => ({
  board: Array(9).fill(null),
  turn: starter,
  starter,
  winner: null,
  winningLine: [],
  draw: false,
  scores: scores || { X: 0, O: 0, draws: 0 },
});

export const getWinner = board => {
  const line = WIN_LINES.find(
    indexes =>
      board[indexes[0]] &&
      board[indexes[0]] === board[indexes[1]] &&
      board[indexes[0]] === board[indexes[2]],
  );
  return line ? { player: board[line[0]], line } : null;
};

export const playTicTacToe = (game, index) => {
  if (index < 0 || index > 8 || game.board[index] || game.winner || game.draw) {
    return game;
  }
  const board = [...game.board];
  board[index] = game.turn;
  const victory = getWinner(board);
  if (victory) {
    return {
      ...game,
      board,
      winner: victory.player,
      winningLine: victory.line,
      scores: {
        ...game.scores,
        [victory.player]: game.scores[victory.player] + 1,
      },
    };
  }
  if (board.every(Boolean)) {
    return {
      ...game,
      board,
      draw: true,
      scores: { ...game.scores, draws: game.scores.draws + 1 },
    };
  }
  return { ...game, board, turn: game.turn === 'X' ? 'O' : 'X' };
};

export const nextTicTacToeRound = game =>
  createTicTacToe(game.starter === 'X' ? 'O' : 'X', game.scores);

export const resetTicTacToeScores = () => createTicTacToe('X');

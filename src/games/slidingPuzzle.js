/* eslint-disable no-loop-func */

export const solvedBoard = size => [
  ...Array.from({ length: size * size - 1 }, (_, index) => index + 1),
  0,
];

export const isPuzzleSolved = (board, size) =>
  board.every((value, index) => value === solvedBoard(size)[index]);

export const isPuzzleSolvable = (board, size) => {
  const values = board.filter(Boolean);
  let inversions = 0;
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      if (values[left] > values[right]) inversions += 1;
    }
  }
  if (size % 2) return inversions % 2 === 0;
  const blankRowFromBottom = size - Math.floor(board.indexOf(0) / size);
  return blankRowFromBottom % 2 === 0
    ? inversions % 2 === 1
    : inversions % 2 === 0;
};

export const adjacentIndexes = (emptyIndex, size) => {
  const row = Math.floor(emptyIndex / size);
  const column = emptyIndex % size;
  return [
    row > 0 ? emptyIndex - size : null,
    row < size - 1 ? emptyIndex + size : null,
    column > 0 ? emptyIndex - 1 : null,
    column < size - 1 ? emptyIndex + 1 : null,
  ].filter(index => index !== null);
};

export const movePuzzle = (board, size, tileIndex) => {
  const emptyIndex = board.indexOf(0);
  if (!adjacentIndexes(emptyIndex, size).includes(tileIndex)) return board;
  const next = [...board];
  next[emptyIndex] = next[tileIndex];
  next[tileIndex] = 0;
  return next;
};

export const movePuzzleLine = (board, size, tileIndex) => {
  const emptyIndex = board.indexOf(0);
  if (tileIndex === emptyIndex) return board;
  const tileRow = Math.floor(tileIndex / size);
  const tileColumn = tileIndex % size;
  const emptyRow = Math.floor(emptyIndex / size);
  const emptyColumn = emptyIndex % size;
  if (tileRow !== emptyRow && tileColumn !== emptyColumn) return board;

  const next = [...board];
  if (tileRow === emptyRow) {
    const direction = tileIndex < emptyIndex ? 1 : -1;
    for (let index = emptyIndex; index !== tileIndex; index -= direction) {
      next[index] = next[index - direction];
    }
  } else {
    const direction = tileIndex < emptyIndex ? size : -size;
    for (let index = emptyIndex; index !== tileIndex; index -= direction) {
      next[index] = next[index - direction];
    }
  }
  next[tileIndex] = 0;
  return next;
};

export const shufflePuzzle = (
  size,
  moves = size * size * 24,
  random = Math.random,
) => {
  let board = solvedBoard(size);
  let previousEmpty = -1;
  for (let step = 0; step < moves; step += 1) {
    const empty = board.indexOf(0);
    const choices = adjacentIndexes(empty, size).filter(
      index => index !== previousEmpty,
    );
    const choice = choices[Math.floor(random() * choices.length)];
    previousEmpty = empty;
    board = movePuzzle(board, size, choice);
  }
  if (isPuzzleSolved(board, size)) {
    board = movePuzzle(board, size, adjacentIndexes(board.indexOf(0), size)[0]);
  }
  return board;
};

export const createPuzzle = (size, random = Math.random) => ({
  size,
  board: shufflePuzzle(size, size * size * 24, random),
  moves: 0,
  elapsed: 0,
  status: 'playing',
  startedAt: Date.now(),
});

export const createPuzzleSetup = size => ({
  size,
  board: solvedBoard(size),
  moves: 0,
  elapsed: 0,
  status: 'ready',
  startedAt: null,
});

export const startPuzzle = (game, random = Math.random) => ({
  ...game,
  board: shufflePuzzle(game.size, game.size * game.size * 24, random),
  moves: 0,
  elapsed: 0,
  status: 'playing',
  startedAt: Date.now(),
});

export const pausePuzzle = game => {
  if (game.status !== 'playing') return game;
  return {
    ...game,
    elapsed: Math.max(
      game.elapsed,
      Math.floor((Date.now() - game.startedAt) / 1000),
    ),
    status: 'paused',
  };
};

export const resumePuzzle = game =>
  game.status === 'paused'
    ? {
        ...game,
        status: 'playing',
        startedAt: Date.now() - (game.elapsed || 0) * 1000,
      }
    : game;

export const playPuzzle = (game, tileIndex) => {
  if (game.status !== 'playing') return game;
  const board = movePuzzleLine(game.board, game.size, tileIndex);
  if (board === game.board) return game;
  const elapsed = Math.max(
    game.elapsed,
    Math.floor((Date.now() - game.startedAt) / 1000),
  );
  return {
    ...game,
    board,
    moves: game.moves + 1,
    elapsed,
    status: isPuzzleSolved(board, game.size) ? 'won' : 'playing',
  };
};

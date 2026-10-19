/* eslint-disable no-continue, no-param-reassign */

const neighborsOf = (index, rows, columns) => {
  const row = Math.floor(index / columns);
  const column = index % columns;
  const neighbors = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (!rowOffset && !columnOffset) continue;
      const nextRow = row + rowOffset;
      const nextColumn = column + columnOffset;
      if (
        nextRow >= 0 &&
        nextRow < rows &&
        nextColumn >= 0 &&
        nextColumn < columns
      ) {
        neighbors.push(nextRow * columns + nextColumn);
      }
    }
  }
  return neighbors;
};

export const createMinesweeper = (rows, columns, mineCount) => ({
  rows,
  columns,
  mineCount,
  cells: Array.from({ length: rows * columns }, () => ({
    mine: false,
    adjacent: 0,
    revealed: false,
    flagged: false,
    exploded: false,
    wrongFlag: false,
  })),
  generated: false,
  status: 'ready',
  elapsed: 0,
  startedAt: null,
});

export const placeMines = (game, safeIndex, random = Math.random) => {
  const protectedIndexes = new Set([
    safeIndex,
    ...neighborsOf(safeIndex, game.rows, game.columns),
  ]);
  let candidates = game.cells
    .map((cell, index) => index)
    .filter(index => !protectedIndexes.has(index));
  if (candidates.length < game.mineCount) {
    candidates = game.cells
      .map((cell, index) => index)
      .filter(index => index !== safeIndex);
  }
  const mines = new Set();
  while (mines.size < game.mineCount) {
    const candidateIndex = Math.floor(random() * candidates.length);
    mines.add(candidates[candidateIndex]);
    candidates.splice(candidateIndex, 1);
  }
  const cells = game.cells.map((cell, index) => ({
    ...cell,
    mine: mines.has(index),
  }));
  cells.forEach((cell, index) => {
    if (!cell.mine) {
      cell.adjacent = neighborsOf(index, game.rows, game.columns).filter(
        neighbor => cells[neighbor].mine,
      ).length;
    }
  });
  return {
    ...game,
    cells,
    generated: true,
    status: 'playing',
    startedAt: Date.now(),
  };
};

const finishLoss = (game, cells, explodedIndex) => ({
  ...game,
  status: 'lost',
  cells: cells.map((cell, index) => ({
    ...cell,
    revealed: cell.mine || cell.revealed,
    exploded: index === explodedIndex,
    wrongFlag: cell.flagged && !cell.mine,
  })),
});

const revealArea = (game, cells, startIndexes) => {
  const queue = [...startIndexes];
  const visited = new Set();
  while (queue.length) {
    const index = queue.shift();
    if (visited.has(index)) continue;
    visited.add(index);
    const cell = cells[index];
    if (!cell || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    if (cell.adjacent === 0) {
      neighborsOf(index, game.rows, game.columns).forEach(neighbor => {
        if (!visited.has(neighbor)) queue.push(neighbor);
      });
    }
  }
};

const withWinCheck = game => {
  const safeCells = game.cells.filter(cell => !cell.mine);
  return safeCells.every(cell => cell.revealed)
    ? { ...game, status: 'won' }
    : game;
};

export const revealCell = (inputGame, index, random = Math.random) => {
  if (inputGame.status === 'won' || inputGame.status === 'lost')
    return inputGame;
  const game = inputGame.generated
    ? inputGame
    : placeMines(inputGame, index, random);
  const selected = game.cells[index];
  if (!selected || selected.revealed || selected.flagged) return game;
  const cells = game.cells.map(cell => ({ ...cell }));
  if (cells[index].mine) return finishLoss(game, cells, index);
  revealArea(game, cells, [index]);
  return withWinCheck({ ...game, cells, status: 'playing' });
};

export const toggleFlag = (game, index) => {
  if (game.status === 'won' || game.status === 'lost') return game;
  const selected = game.cells[index];
  if (!selected || selected.revealed) return game;
  const cells = game.cells.map((cell, cellIndex) =>
    cellIndex === index ? { ...cell, flagged: !cell.flagged } : cell,
  );
  return { ...game, cells };
};

export const chordCell = (game, index) => {
  if (game.status !== 'playing') return game;
  const selected = game.cells[index];
  if (!selected || !selected.revealed || selected.adjacent === 0) return game;
  const neighbors = neighborsOf(index, game.rows, game.columns);
  const flags = neighbors.filter(neighbor => game.cells[neighbor].flagged)
    .length;
  if (flags !== selected.adjacent) return game;
  const cells = game.cells.map(cell => ({ ...cell }));
  const hidden = neighbors.filter(
    neighbor => !cells[neighbor].flagged && !cells[neighbor].revealed,
  );
  const mine = hidden.find(neighbor => cells[neighbor].mine);
  if (mine !== undefined) return finishLoss(game, cells, mine);
  revealArea(game, cells, hidden);
  return withWinCheck({ ...game, cells });
};

export const countFlags = game =>
  game.cells.filter(cell => cell.flagged).length;
export { neighborsOf };

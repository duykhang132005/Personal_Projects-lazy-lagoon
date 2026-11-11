const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { countAdjacent, floodReveal } = require('../js/minesweeper.js');

function cell(opts) {
  return Object.assign({ mine: false, adj: 0, revealed: false, flagged: false }, opts);
}

function gridFrom(mines, rows, cols) {
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push(cell({ mine: !!mines[r][c] }));
    }
    grid.push(row);
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c].mine) grid[r][c].adj = countAdjacent(grid, rows, cols, r, c);
    }
  }
  return grid;
}

describe('Minesweeper adjacency', () => {
  test('counts all eight neighbors, including diagonals', () => {
    const mines = [
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ];
    const grid = gridFrom(mines, 3, 3);
    assert.equal(countAdjacent(grid, 3, 3, 1, 1), 8);
    assert.equal(grid[1][1].adj, 8);
  });

  test('counts only orthogonal neighbors when diagonals are empty', () => {
    const mines = [
      [0, 1, 0],
      [1, 0, 1],
      [0, 1, 0],
    ];
    const grid = gridFrom(mines, 3, 3);
    assert.equal(countAdjacent(grid, 3, 3, 1, 1), 4);
  });

  test('counts only diagonal neighbors when orthogonals are empty', () => {
    const mines = [
      [1, 0, 1],
      [0, 0, 0],
      [1, 0, 1],
    ];
    const grid = gridFrom(mines, 3, 3);
    assert.equal(countAdjacent(grid, 3, 3, 1, 1), 4);
  });

  test('does not count itself or cells off the board', () => {
    const mines = [
      [1, 0],
      [0, 1],
    ];
    const grid = gridFrom(mines, 2, 2);
    assert.equal(countAdjacent(grid, 2, 2, 0, 1), 2);
    assert.equal(countAdjacent(grid, 2, 2, 0, 0), 1);
  });
});

describe('Minesweeper flood-fill', () => {
  test('reveals a connected zero region and its bordering numbered cells', () => {
    // Mines at corners; center 3x3 zeros, edges are numbered.
    const mines = [
      [1, 0, 0, 0, 1],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [1, 0, 0, 0, 1],
    ];
    const grid = gridFrom(mines, 5, 5);
    const newly = floodReveal(grid, 5, 5, 2, 2);
    assert.ok(newly.length > 1);
    assert.equal(grid[2][2].revealed, true);
    assert.equal(grid[2][2].adj, 0);
    // Corner mines stay hidden; cells next to them are revealed as numbered borders.
    assert.equal(grid[0][0].revealed, false);
    assert.equal(grid[0][1].revealed, true);
    assert.ok(grid[0][1].adj > 0);
    assert.equal(grid[1][1].revealed, true);
  });

  test('does not walk through numbered cells into the far side, or reveal mines or flags', () => {
    const mines = [
      [0, 0, 1],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const grid = gridFrom(mines, 3, 3);
    grid[2][0].flagged = true;
    floodReveal(grid, 3, 3, 2, 2);
    assert.equal(grid[0][2].revealed, false);
    assert.equal(grid[0][2].mine, true);
    assert.equal(grid[2][0].revealed, false);
    assert.equal(grid[2][0].flagged, true);
    assert.equal(grid[1][2].revealed, true);
    assert.ok(grid[1][2].adj > 0);
  });
});

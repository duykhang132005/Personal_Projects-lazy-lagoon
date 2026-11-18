const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { canPlace, isOverlayOpen } = require('../js/sudoku.js');

function empty() {
  return Array(81).fill(0);
}

describe('Sudoku canPlace', () => {
  test('allows a digit on an empty board', () => {
    assert.equal(canPlace(empty(), 0, 5), true);
  });

  test('rejects a row conflict', () => {
    const board = empty();
    board[0] = 5;
    assert.equal(canPlace(board, 8, 5), false);
    assert.equal(canPlace(board, 8, 6), true);
  });

  test('rejects a column conflict', () => {
    const board = empty();
    board[0] = 5;
    assert.equal(canPlace(board, 72, 5), false);
    assert.equal(canPlace(board, 72, 6), true);
  });

  test('rejects a 3x3 box conflict that is not a row or column clash', () => {
    const board = empty();
    board[0] = 5; // r1c1
    // r2c2 is a different row and column, same box
    assert.equal(canPlace(board, 10, 5), false);
    assert.equal(canPlace(board, 10, 6), true);
    // r2c4 is a different row, column, and box, so 5 is allowed
    assert.equal(canPlace(board, 12, 5), true);
  });
});

function fakeOverlay(visible, ariaHidden) {
  return {
    classList: { contains: (name) => name === 'visible' && !!visible },
    getAttribute: (name) => (name === 'aria-hidden' ? ariaHidden : null),
  };
}

describe('Sudoku overlay blocks keys', () => {
  test('is closed when the overlay is missing, hidden, or aria-hidden', () => {
    assert.equal(isOverlayOpen(null), false);
    assert.equal(isOverlayOpen(fakeOverlay(false, 'true')), false);
    assert.equal(isOverlayOpen(fakeOverlay(true, 'true')), false);
    assert.equal(isOverlayOpen(fakeOverlay(false, 'false')), false);
  });

  test('is open only when the overlay is visible and aria-hidden is false', () => {
    assert.equal(isOverlayOpen(fakeOverlay(true, 'false')), true);
  });
});

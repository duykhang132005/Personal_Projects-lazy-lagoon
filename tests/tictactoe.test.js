const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { findWinOn, isDrawOn } = require('../js/tictactoe.js');

function board(marks) {
  const b = Array(9).fill(null);
  for (let i = 0; i < 9; i++) if (marks[i] && marks[i] !== '.') b[i] = marks[i];
  return b;
}

describe('Tic-Tac-Toe win lines', () => {
  const wins = [
    ['XXX......', [0, 1, 2], 'top row'],
    ['...XXX...', [3, 4, 5], 'middle row'],
    ['......XXX', [6, 7, 8], 'bottom row'],
    ['X..X..X..', [0, 3, 6], 'left column'],
    ['.X..X..X.', [1, 4, 7], 'middle column'],
    ['..X..X..X', [2, 5, 8], 'right column'],
    ['X...X...X', [0, 4, 8], 'main diagonal'],
    ['..X.X.X..', [2, 4, 6], 'anti-diagonal'],
  ];

  for (const [marks, cells, name] of wins) {
    test('detects the ' + name, () => {
      const found = findWinOn(board(marks), 'X');
      assert.ok(found, name + ' should win');
      assert.deepEqual([...found].sort((a, b) => a - b), cells);
      assert.equal(findWinOn(board(marks), 'O'), null);
    });
  }

  test('does not report a win for two in a row or a non-line of three', () => {
    assert.equal(findWinOn(board('XXO......'), 'X'), null);
    assert.equal(findWinOn(board('X.X.X....'), 'X'), null); // corners of top+center, not a line
    assert.equal(findWinOn(board('XX.....OO'), 'X'), null);
    assert.equal(findWinOn(board('.........'), 'X'), null);
  });
});

describe('Tic-Tac-Toe draw detection', () => {
  test('a full board with no winner is a draw', () => {
    // X O X
    // X O O
    // O X X
    const draw = board('XOX XOOOXX'.replace(/ /g, ''));
    assert.equal(findWinOn(draw, 'X'), null);
    assert.equal(findWinOn(draw, 'O'), null);
    assert.equal(isDrawOn(draw), true);
  });

  test('a winning full board is not a draw, and an incomplete board is not a draw', () => {
    const won = board('XXXOO....');
    assert.ok(findWinOn(won, 'X'));
    assert.equal(isDrawOn(won), false);
    assert.equal(isDrawOn(board('XOX......')), false);
  });
});

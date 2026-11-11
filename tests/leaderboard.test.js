const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { MAX_ENTRIES, lowerBetter, sortList, qualifies, emptyBoard, setList } = require('../js/leaderboard.js');

function entry(name, score, at) {
  return { name, score, at: at || '2026-01-01T00:00:00.000Z' };
}

describe('Leaderboard ranking', () => {
  test('MAX_ENTRIES is 10', () => {
    assert.equal(MAX_ENTRIES, 10);
  });

  test('higher-is-better games list the biggest score first', () => {
    assert.equal(lowerBetter('snake'), false);
    assert.equal(lowerBetter('twenty48'), false);
    const ranked = sortList('snake', [entry('a', 10), entry('b', 50), entry('c', 25)]);
    assert.deepEqual(ranked.map((e) => e.name), ['b', 'c', 'a']);
    assert.deepEqual(ranked.map((e) => e.score), [50, 25, 10]);
  });

  test('lower-is-better times, including Breakout clear time, list the fastest first', () => {
    assert.equal(lowerBetter('breakout'), true);
    assert.equal(lowerBetter('minesweeper'), true);
    assert.equal(lowerBetter('sudoku'), true);
    const ranked = sortList('breakout', [entry('slow', 90), entry('fast', 12), entry('mid', 40)]);
    assert.deepEqual(ranked.map((e) => e.name), ['fast', 'mid', 'slow']);
    assert.deepEqual(ranked.map((e) => e.score), [12, 40, 90]);
  });

  test('keeps only the top 10 after ranking', () => {
    const list = [];
    for (let i = 1; i <= 11; i++) list.push(entry('p' + i, i));
    const ranked = sortList('snake', list);
    assert.equal(ranked.length, 10);
    assert.equal(ranked[0].score, 11);
    assert.equal(ranked[9].score, 2);
    assert.ok(!ranked.some((e) => e.score === 1));
  });

  test('a tied score keeps earlier input order because the sort is stable', () => {
    const ranked = sortList('snake', [entry('first', 20, '2026-01-01'), entry('second', 20, '2026-02-01'), entry('low', 5)]);
    assert.deepEqual(ranked.map((e) => e.name), ['first', 'second', 'low']);
  });

  test('qualifies uses a strict cutoff: equal to the 10th place does not get in', () => {
    const board = emptyBoard();
    const filled = [];
    for (let i = 0; i < 10; i++) filled.push(entry('p' + i, 100 - i));
    setList(board, 'snake', null, filled);
    assert.equal(qualifies(board, 'snake', null, 92), true);
    assert.equal(qualifies(board, 'snake', null, 91), false);
    setList(board, 'breakout', null, [entry('a', 10), entry('b', 20), entry('c', 30), entry('d', 40), entry('e', 50), entry('f', 60), entry('g', 70), entry('h', 80), entry('i', 90), entry('j', 100)]);
    assert.equal(qualifies(board, 'breakout', null, 99), true);
    assert.equal(qualifies(board, 'breakout', null, 100), false);
  });
});

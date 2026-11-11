const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { resolvePair } = require('../js/memory.js');

describe('Memory matching', () => {
  test('matching symbols count as a pair and increment the match total', () => {
    const result = resolvePair({ symbol: 'A' }, { symbol: 'A' }, 0, 2);
    assert.equal(result.match, true);
    assert.equal(result.matchedCount, 1);
    assert.equal(result.complete, false);
  });

  test('different symbols are a non-match and leave the total unchanged', () => {
    const result = resolvePair({ symbol: 'A' }, { symbol: 'B' }, 1, 2);
    assert.equal(result.match, false);
    assert.equal(result.matchedCount, 1);
    assert.equal(result.complete, false);
  });

  test('the last pair completes the game', () => {
    const result = resolvePair({ symbol: 'Z' }, { symbol: 'Z' }, 5, 6);
    assert.equal(result.match, true);
    assert.equal(result.matchedCount, 6);
    assert.equal(result.complete, true);
  });

  test('a non-match cannot complete the game even if one pair remains', () => {
    const result = resolvePair({ symbol: 'A' }, { symbol: 'B' }, 5, 6);
    assert.equal(result.match, false);
    assert.equal(result.complete, false);
  });
});

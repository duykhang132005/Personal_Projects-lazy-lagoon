const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { SIZE, slideLine, isOverlayOpen } = require('../js/2048.js');

function slide(values) {
  const line = values.slice();
  while (line.length < SIZE) line.push(0);
  return slideLine(line).line;
}

describe('2048 slideLine', () => {
  test('SIZE is 4 and pads with zeros', () => {
    assert.equal(SIZE, 4);
    assert.deepEqual(slide([2, 2]), [4, 0, 0, 0]);
  });

  test('merges a single pair to the left', () => {
    assert.deepEqual(slide([2, 2, 0, 0]), [4, 0, 0, 0]);
    assert.equal(slideLine([2, 2, 0, 0]).gained, 4);
  });

  test('does not double-merge in one slide: [2,2,2,2] becomes [4,4]', () => {
    assert.deepEqual(slide([2, 2, 2, 2]), [4, 4, 0, 0]);
    assert.equal(slideLine([2, 2, 2, 2]).gained, 8);
  });

  test('does not double-merge a fresh merge into the next tile: [4,4,8] becomes [8,8] not 16', () => {
    assert.deepEqual(slide([4, 4, 8]), [8, 8, 0, 0]);
    assert.notDeepEqual(slide([4, 4, 8]), [16, 0, 0, 0]);
  });

  test('slides tiles without merging different values', () => {
    assert.deepEqual(slide([2, 0, 4, 0]), [2, 4, 0, 0]);
    assert.deepEqual(slide([2, 4, 8, 16]), [2, 4, 8, 16]);
  });
});

function fakeOverlay(visible, ariaHidden) {
  return {
    classList: { contains: (name) => name === 'visible' && !!visible },
    getAttribute: (name) => (name === 'aria-hidden' ? ariaHidden : null),
  };
}

describe('2048 overlay blocks moves', () => {
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

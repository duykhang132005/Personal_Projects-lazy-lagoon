const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { isOverlayOpen } = require('../js/breakout.js');

function fakeOverlay(visible, ariaHidden) {
  return {
    classList: { contains: (name) => name === 'visible' && !!visible },
    getAttribute: (name) => (name === 'aria-hidden' ? ariaHidden : null),
  };
}

describe('Breakout overlay open helper', () => {
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

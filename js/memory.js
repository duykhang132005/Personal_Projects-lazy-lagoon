/* Lazy Lagoon - Memory Match */
(function (global) {
  const BEST_KEY = 'memory.bestMoves';
  const PAIR_COUNT = 8;
  const EMOJI_POOL = [
    '🐠', '🐙', '🦀', '🐚', '🌊', '🐟', '🐡', '🦈',
    '🪸', '🐋', '🐬', '🦭', '🦑', '🦐', '🦞', '🌴',
    '🌅', '⭐', '🌙', '💎', '🔮', '🧿', '🛶', '⛵',
  ];
  const FLIP_DELAY = 650;

  let cards = [];
  let flipped = [];
  let matched = 0;
  let moves = 0;
  let locked = false;
  let startedAt = 0;
  let timerId = null;
  let elapsed = 0;
  let won = false;
  let bound = false;
  let best = null;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function pickSymbols() {
    return shuffle(EMOJI_POOL).slice(0, PAIR_COUNT);
  }

  function updateHud() {
    const m = document.getElementById('memory-moves');
    const t = document.getElementById('memory-time');
    const b = document.getElementById('memory-best');
    if (m) m.textContent = String(moves);
    if (t) t.textContent = LazyStorage.formatTime(elapsed);
    if (b) b.textContent = best == null ? '-' : String(best);
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  function startTimer() {
    if (timerId || won) return;
    if (!startedAt) startedAt = Date.now();
    timerId = setInterval(() => {
      elapsed = Math.floor((Date.now() - startedAt) / 1000);
      updateHud();
    }, 250);
  }

  function hideOverlay() {
    const ov = document.getElementById('memory-overlay');
    if (!ov) return;
    ov.classList.remove('visible');
    ov.setAttribute('aria-hidden', 'true');
  }

  function showOverlay(title, msg, canSubmit) {
    const ov = document.getElementById('memory-overlay');
    if (!ov) return;
    ov.querySelector('h3').textContent = title;
    ov.querySelector('p').textContent = msg;
    if (global.LazyLeaderboard) {
      LazyLeaderboard.fillScoreForm(ov, {
        show: !!canSubmit,
        getPayload: () => ({
          game: 'memory',
          score: moves,
          unit: 'moves',
          metric: 'moves',
        }),
      });
    }
    ov.classList.add('visible');
    ov.setAttribute('aria-hidden', 'false');
  }

  function render() {
    const board = document.getElementById('memory-board');
    if (!board) return;
    board.innerHTML = '';
    cards.forEach((card, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'memory-card';
      if (card.flipped || card.matched) btn.classList.add('flipped');
      if (card.matched) btn.classList.add('matched');
      btn.disabled = won || card.matched || locked;
      btn.setAttribute(
        'aria-label',
        card.flipped || card.matched ? 'Card ' + card.symbol : 'Face-down card'
      );
      const front = document.createElement('span');
      front.className = 'memory-face memory-front';
      front.setAttribute('aria-hidden', 'true');
      front.textContent = '?';
      const back = document.createElement('span');
      back.className = 'memory-face memory-back';
      back.setAttribute('aria-hidden', 'true');
      back.textContent = card.symbol;
      btn.appendChild(front);
      btn.appendChild(back);
      btn.addEventListener('click', () => flip(i));
      board.appendChild(btn);
    });
  }

  function flip(i) {
    if (won || locked) return;
    const card = cards[i];
    if (!card || card.flipped || card.matched) return;
    startTimer();
    card.flipped = true;
    flipped.push(i);
    render();

    if (flipped.length < 2) return;

    moves += 1;
    updateHud();
    const a = cards[flipped[0]];
    const b = cards[flipped[1]];
    if (a.symbol === b.symbol) {
      a.matched = true;
      b.matched = true;
      flipped = [];
      matched += 1;
      render();
      if (matched >= PAIR_COUNT) win();
    } else {
      locked = true;
      const pending = flipped.slice();
      setTimeout(() => {
        pending.forEach((idx) => {
          if (cards[idx] && !cards[idx].matched) cards[idx].flipped = false;
        });
        flipped = [];
        locked = false;
        render();
      }, FLIP_DELAY);
    }
  }

  function win() {
    won = true;
    stopTimer();
    elapsed = Math.floor((Date.now() - startedAt) / 1000);
    best = LazyStorage.updateBestLow(BEST_KEY, moves);
    updateHud();
    refreshLobbyStats();
    const msg =
      'Moves: ' +
      moves +
      ' · Time: ' +
      LazyStorage.formatTime(elapsed) +
      (best === moves ? ' · New best!' : '');
    showOverlay('All matched!', msg, true);
  }

  function reset() {
    stopTimer();
    const pool = pickSymbols();
    const deck = shuffle(pool.concat(pool));
    cards = deck.map((symbol) => ({ symbol, flipped: false, matched: false }));
    flipped = [];
    matched = 0;
    moves = 0;
    locked = false;
    startedAt = 0;
    elapsed = 0;
    won = false;
    best = LazyStorage.get(BEST_KEY, null);
    if (best != null) best = Number(best);
    if (global.LazyLeaderboard) LazyLeaderboard.resetRound();
    hideOverlay();
    updateHud();
    render();
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.getElementById('memory-restart')?.addEventListener('click', reset);
    document.getElementById('memory-again')?.addEventListener('click', reset);
    document.getElementById('memory-exit')?.addEventListener('click', () => {
      hideOverlay();
      if (global.LazyLagoon) LazyLagoon.navigate('/');
    });
  }

  function refreshLobbyStats() {
    const el = document.querySelector('[data-stat="memory"]');
    if (!el) return;
    const v = LazyStorage.get(BEST_KEY, null);
    el.textContent = v == null ? 'Best: -' : 'Best: ' + v + ' moves';
  }

  function mount() {
    bind();
    reset();
    refreshLobbyStats();
  }

  function unmount() {
    stopTimer();
    hideOverlay();
  }

  global.MemoryGame = { mount, unmount, refreshLobbyStats, BEST_KEY };
})(typeof window !== 'undefined' ? window : globalThis);
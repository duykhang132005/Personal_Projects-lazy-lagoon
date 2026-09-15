/* Lazy Lagoon - 2048 */
(function (global) {
  const SIZE = 4;
  const BEST_KEY = 'twenty48.best';

  let grid = [];
  let score = 0;
  let best = 0;
  let over = false;
  let won = false;
  let wonAck = false;
  let bound = false;
  let touchStart = null;

  function emptyGrid() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function spawn() {
    const empty = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) empty.push([r, c]);
      }
    }
    if (!empty.length) return false;
    const [r, c] = empty[(Math.random() * empty.length) | 0];
    grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    return true;
  }

  function updateHud() {
    const s = document.getElementById('t48-score');
    const b = document.getElementById('t48-best');
    if (s) s.textContent = String(score);
    if (b) b.textContent = String(best);
  }

  function hideOverlay() {
    document.getElementById('t48-overlay')?.classList.remove('visible');
  }

  function showOverlay(title, msg, canSubmit, opts) {
    const ov = document.getElementById('t48-overlay');
    if (!ov) return;
    ov.querySelector('h3').textContent = title;
    ov.querySelector('p').textContent = msg;
    const cont = document.getElementById('t48-continue');
    if (cont) cont.style.display = opts && opts.continue ? '' : 'none';
    const again = document.getElementById('t48-again');
    if (again) again.style.display = opts && opts.continue ? 'none' : '';
    if (global.LazyLeaderboard) {
      LazyLeaderboard.fillScoreForm(ov, {
        show: !!canSubmit,
        getPayload: () => ({
          game: 'twenty48',
          score: score,
          unit: 'pts',
          metric: 'score',
        }),
      });
    }
    ov.classList.add('visible');
  }

  function tileClass(v) {
    if (!v) return 't48-tile empty';
    const n = Math.min(v, 2048);
    return 't48-tile t' + n + (v > 2048 ? ' tsuper' : '');
  }

  function render() {
    const board = document.getElementById('t48-board');
    if (!board) return;
    board.innerHTML = '';
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = grid[r][c];
        const cell = document.createElement('div');
        cell.className = tileClass(v);
        cell.textContent = v ? String(v) : '';
        board.appendChild(cell);
      }
    }
  }

  function slideLine(line) {
    const filtered = line.filter((v) => v !== 0);
    const out = [];
    let gained = 0;
    let i = 0;
    while (i < filtered.length) {
      if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
        const merged = filtered[i] * 2;
        out.push(merged);
        gained += merged;
        if (merged === 2048) won = true;
        i += 2;
      } else {
        out.push(filtered[i]);
        i += 1;
      }
    }
    while (out.length < SIZE) out.push(0);
    return { line: out, gained };
  }

  function move(dir) {
    // dir: 'left' | 'right' | 'up' | 'down'
    if (over) return;
    const prev = grid.map((row) => row.slice());
    let gained = 0;

    if (dir === 'left' || dir === 'right') {
      for (let r = 0; r < SIZE; r++) {
        let line = grid[r].slice();
        if (dir === 'right') line.reverse();
        const res = slideLine(line);
        if (dir === 'right') res.line.reverse();
        grid[r] = res.line;
        gained += res.gained;
      }
    } else {
      for (let c = 0; c < SIZE; c++) {
        let line = [];
        for (let r = 0; r < SIZE; r++) line.push(grid[r][c]);
        if (dir === 'down') line.reverse();
        const res = slideLine(line);
        if (dir === 'down') res.line.reverse();
        for (let r = 0; r < SIZE; r++) grid[r][c] = res.line[r];
        gained += res.gained;
      }
    }

    let changed = false;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] !== prev[r][c]) changed = true;
      }
    }
    if (!changed) return;

    score += gained;
    best = LazyStorage.updateBestHigh(BEST_KEY, score);
    spawn();
    updateHud();
    render();
    refreshLobbyStats();

    if (won && !wonAck) {
      wonAck = true;
      showOverlay('2048!', 'Score: ' + score + ' — keep going or start fresh.', false, { continue: true });
      return;
    }

    if (!canMove()) {
      over = true;
      best = LazyStorage.updateBestHigh(BEST_KEY, score);
      updateHud();
      refreshLobbyStats();
      showOverlay('Game Over', 'Score: ' + score + (score >= best ? ' · New best!' : ''), true, {});
    }
  }

  function canMove() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) return true;
        if (c + 1 < SIZE && grid[r][c] === grid[r][c + 1]) return true;
        if (r + 1 < SIZE && grid[r][c] === grid[r + 1][c]) return true;
      }
    }
    return false;
  }

  function reset() {
    grid = emptyGrid();
    score = 0;
    over = false;
    won = false;
    wonAck = false;
    best = LazyStorage.getNumber(BEST_KEY, 0);
    spawn();
    spawn();
    if (global.LazyLeaderboard) LazyLeaderboard.resetRound();
    hideOverlay();
    updateHud();
    render();
  }

  function onKey(e) {
    const view = document.getElementById('view-2048');
    if (!view || !view.classList.contains('active')) return;
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;
    const k = e.key.toLowerCase();
    const map = {
      arrowleft: 'left', a: 'left',
      arrowright: 'right', d: 'right',
      arrowup: 'up', w: 'up',
      arrowdown: 'down', s: 'down',
    };
    if (!map[k]) return;
    e.preventDefault();
    move(map[k]);
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.addEventListener('keydown', onKey);
    document.getElementById('t48-new')?.addEventListener('click', reset);
    document.getElementById('t48-again')?.addEventListener('click', reset);
    document.getElementById('t48-continue')?.addEventListener('click', () => {
      hideOverlay();
    });
    document.getElementById('t48-exit')?.addEventListener('click', () => {
      hideOverlay();
      if (global.LazyLagoon) LazyLagoon.navigate('/');
    });
    document.querySelectorAll('[data-t48-dir]').forEach((btn) => {
      const go = (e) => {
        e.preventDefault();
        move(btn.getAttribute('data-t48-dir'));
      };
      btn.addEventListener('click', go);
      btn.addEventListener('touchstart', go, { passive: false });
    });

    const stage = document.getElementById('t48-board');
    if (stage) {
      stage.addEventListener('touchstart', (e) => {
        if (!e.touches || !e.touches[0]) return;
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }, { passive: true });
      stage.addEventListener('touchend', (e) => {
        if (!touchStart || !e.changedTouches || !e.changedTouches[0]) return;
        const dx = e.changedTouches[0].clientX - touchStart.x;
        const dy = e.changedTouches[0].clientY - touchStart.y;
        touchStart = null;
        if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
        if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
        else move(dy > 0 ? 'down' : 'up');
      }, { passive: true });
    }
  }

  function refreshLobbyStats() {
    const el = document.querySelector('[data-stat="twenty48"]');
    if (el) el.textContent = 'Best: ' + LazyStorage.getNumber(BEST_KEY, 0);
  }

  function mount() {
    bind();
    reset();
    refreshLobbyStats();
  }

  function unmount() {}

  global.Twenty48Game = { mount, unmount, refreshLobbyStats, BEST_KEY };
})(typeof window !== 'undefined' ? window : globalThis);

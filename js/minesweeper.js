/* Lazy Lagoon - Minesweeper */
(function (global) {
  const DIFFS = {
    easy: { rows: 9, cols: 9, mines: 10, label: 'Easy' },
    medium: { rows: 16, cols: 16, mines: 40, label: 'Medium' },
    hard: { rows: 16, cols: 30, mines: 99, label: 'Hard' },
  };

  let difficulty = 'easy';
  let grid = [];
  let rows, cols, mineCount;
  let revealed, flagged, started, won, lost;
  let timerId, elapsed;
  let longPressTimer = null;
  let bound = false;

  function bestKey(diff) {
    return 'minesweeper.' + diff + '.bestTime';
  }

  function initGrid() {
    const d = DIFFS[difficulty];
    rows = d.rows;
    cols = d.cols;
    mineCount = d.mines;
    grid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push({ mine: false, adj: 0, revealed: false, flagged: false });
      }
      grid.push(row);
    }
    revealed = 0;
    flagged = 0;
    started = false;
    won = false;
    lost = false;
    elapsed = 0;
    clearInterval(timerId);
    timerId = null;
    if (global.LazyLeaderboard) LazyLeaderboard.resetRound();
    render();
    updateHud();
  }

  function placeMines(safeR, safeC) {
    let placed = 0;
    while (placed < mineCount) {
      const r = (Math.random() * rows) | 0;
      const c = (Math.random() * cols) | 0;
      if (grid[r][c].mine) continue;
      if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
      grid[r][c].mine = true;
      placed++;
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].mine) continue;
        let n = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const rr = r + dr, cc = c + dc;
            if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && grid[rr][cc].mine) n++;
          }
        }
        grid[r][c].adj = n;
      }
    }
  }

  function startTimer() {
    clearInterval(timerId);
    timerId = setInterval(() => {
      elapsed++;
      updateHud();
    }, 1000);
  }

  function updateHud() {
    const minesLeft = document.getElementById('ms-mines');
    const timeEl = document.getElementById('ms-time');
    const bestEl = document.getElementById('ms-best');
    if (minesLeft) minesLeft.textContent = String(mineCount - flagged);
    if (timeEl) timeEl.textContent = LazyStorage.formatTime(elapsed);
    const best = LazyStorage.get(bestKey(difficulty), null);
    if (bestEl) {
      bestEl.textContent = best == null ? '-' : LazyStorage.formatTime(best);
    }
    document.querySelectorAll('[data-ms-diff]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-ms-diff') === difficulty);
    });
  }

  function reveal(r, c) {
    if (won || lost) return;
    const cell = grid[r][c];
    if (cell.revealed || cell.flagged) return;

    if (!started) {
      started = true;
      placeMines(r, c);
      startTimer();
    }

    if (cell.mine) {
      cell.revealed = true;
      lost = true;
      clearInterval(timerId);
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          if (grid[i][j].mine) grid[i][j].revealed = true;
        }
      }
      render();
      showOverlay('Boom!', 'You hit a mine. Try again?', false);
      return;
    }

    const stack = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      const cur = grid[cr][cc];
      if (cur.revealed || cur.flagged) continue;
      cur.revealed = true;
      revealed++;
      if (cur.adj === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = cr + dr, ccc = cc + dc;
            if (rr >= 0 && rr < rows && ccc >= 0 && ccc < cols) {
              const n = grid[rr][ccc];
              if (!n.revealed && !n.flagged && !n.mine) stack.push([rr, ccc]);
            }
          }
        }
      }
    }

    checkWin();
    render();
  }

  function toggleFlag(r, c) {
    if (won || lost) return;
    const cell = grid[r][c];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    flagged += cell.flagged ? 1 : -1;
    updateHud();
    render();
  }

  function checkWin() {
    const totalSafe = rows * cols - mineCount;
    if (revealed >= totalSafe) {
      won = true;
      clearInterval(timerId);
      LazyStorage.updateBestLow(bestKey(difficulty), elapsed);
      updateHud();
      refreshLobbyStats();
      showOverlay('Cleared!', 'Time: ' + LazyStorage.formatTime(elapsed), true);
    }
  }

  function render() {
    const board = document.getElementById('ms-board');
    if (!board) return;
    board.className = 'ms-board ' + difficulty;
    board.style.gridTemplateColumns = `repeat(${cols}, auto)`;
    board.innerHTML = '';
    board.setAttribute('role', 'grid');
    board.setAttribute('aria-label', 'Minesweeper board');

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ms-cell';
        btn.setAttribute('role', 'gridcell');
        btn.dataset.r = r;
        btn.dataset.c = c;

        if (cell.revealed) {
          btn.classList.add('revealed');
          btn.disabled = true;
          if (cell.mine) {
            btn.classList.add('mine');
            btn.textContent = '✱';
          } else if (cell.adj > 0) {
            btn.classList.add('n' + cell.adj);
            btn.textContent = String(cell.adj);
          }
        } else if (cell.flagged) {
          btn.classList.add('flagged');
          btn.textContent = '⚑';
          btn.setAttribute('aria-label', 'Flagged');
        } else {
          btn.setAttribute('aria-label', 'Hidden cell');
        }

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          reveal(r, c);
        });
        btn.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          toggleFlag(r, c);
        });

        btn.addEventListener('touchstart', (e) => {
          longPressTimer = setTimeout(() => {
            longPressTimer = 'fired';
            toggleFlag(r, c);
          }, 450);
        }, { passive: true });
        btn.addEventListener('touchend', (e) => {
          if (longPressTimer === 'fired') {
            e.preventDefault();
          }
          clearTimeout(longPressTimer);
          longPressTimer = null;
        });
        btn.addEventListener('touchmove', () => {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        });

        board.appendChild(btn);
      }
    }
  }

  function showOverlay(title, msg, canSubmit) {
    const ov = document.getElementById('ms-overlay');
    if (!ov) return;
    ov.querySelector('h3').textContent = title;
    ov.querySelector('p').textContent = msg;
    if (global.LazyLeaderboard) {
      LazyLeaderboard.fillScoreForm(ov, {
        show: !!canSubmit,
        getPayload: () => ({
          game: 'minesweeper',
          score: elapsed,
          unit: 's',
          metric: 'time',
          difficulty: difficulty,
        }),
      });
    }
    ov.classList.add('visible');
  }

  function hideOverlay() {
    document.getElementById('ms-overlay')?.classList.remove('visible');
  }

  function setDifficulty(diff) {
    if (!DIFFS[diff]) return;
    difficulty = diff;
    hideOverlay();
    initGrid();
  }

  function refreshLobbyStats() {
    const el = document.querySelector('[data-stat="minesweeper"]');
    if (!el) return;
    const parts = ['easy', 'medium', 'hard'].map((d) => {
      const t = LazyStorage.get(bestKey(d), null);
      return DIFFS[d].label[0] + ':' + (t == null ? '-' : LazyStorage.formatTime(t));
    });
    el.textContent = parts.join(' | ');
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.querySelectorAll('[data-ms-diff]').forEach((btn) => {
      btn.addEventListener('click', () => setDifficulty(btn.getAttribute('data-ms-diff')));
    });
    document.getElementById('ms-new')?.addEventListener('click', () => {
      hideOverlay();
      initGrid();
    });
    document.getElementById('ms-again')?.addEventListener('click', () => {
      hideOverlay();
      initGrid();
    });
    document.getElementById('ms-exit')?.addEventListener('click', () => {
      hideOverlay();
      if (global.LazyLagoon) LazyLagoon.navigate('/');
    });
  }

  function mount() {
    bind();
    hideOverlay();
    initGrid();
    refreshLobbyStats();
  }

  function unmount() {
    clearInterval(timerId);
  }

  global.MinesweeperGame = { mount, unmount, refreshLobbyStats, DIFFS, bestKey };
})(typeof window !== 'undefined' ? window : globalThis);
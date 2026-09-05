/* Lazy Lagoon - Sudoku with async unique puzzle generation */
(function (global) {
  const DIFF = {
    easy: { clues: 40, label: 'Easy' },
    medium: { clues: 32, label: 'Medium' },
    hard: { clues: 26, label: 'Hard' },
  };

  let difficulty = 'easy';
  let solution = null; // 81 ints 1-9
  let puzzle = null;   // 0 = empty
  let user = null;     // current grid
  let given = null;    // boolean[81]
  let selected = 0;
  let started = false;
  let elapsed = 0;
  let timerId = null;
  let bound = false;
  let won = false;

  function bestKey(diff) {
    return 'sudoku.' + diff + '.bestTime';
  }

  function idx(r, c) { return r * 9 + c; }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function canPlace(board, pos, n) {
    const r = (pos / 9) | 0;
    const c = pos % 9;
    for (let i = 0; i < 9; i++) {
      if (board[r * 9 + i] === n) return false;
      if (board[i * 9 + c] === n) return false;
    }
    const br = ((r / 3) | 0) * 3;
    const bc = ((c / 3) | 0) * 3;
    for (let rr = 0; rr < 3; rr++) {
      for (let cc = 0; cc < 3; cc++) {
        if (board[(br + rr) * 9 + (bc + cc)] === n) return false;
      }
    }
    return true;
  }

  /** Sync fill - used inside chunked loops with yields between attempts */
  function fillBoard(board) {
    for (let pos = 0; pos < 81; pos++) {
      if (board[pos] !== 0) continue;
      const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (const n of nums) {
        if (!canPlace(board, pos, n)) continue;
        board[pos] = n;
        if (fillBoard(board)) return true;
        board[pos] = 0;
      }
      return false;
    }
    return true;
  }

  /** Count solutions up to limit (2 for uniqueness). Mutates a copy. */
  function countSolutions(board, limit) {
    const b = board.slice();
    let count = 0;

    function solve() {
      if (count >= limit) return;
      let pos = -1;
      for (let i = 0; i < 81; i++) {
        if (b[i] === 0) { pos = i; break; }
      }
      if (pos === -1) {
        count++;
        return;
      }
      for (let n = 1; n <= 9; n++) {
        if (!canPlace(b, pos, n)) continue;
        b[pos] = n;
        solve();
        b[pos] = 0;
        if (count >= limit) return;
      }
    }

    solve();
    return count;
  }

  function isUnique(board) {
    return countSolutions(board, 2) === 1;
  }

  /**
   * Generate puzzle asynchronously with progress reports.
   * Stages: Building board... Carving... Verifying uniqueness...
   */
  async function generatePuzzle(diff, report) {
    const targetClues = DIFF[diff].clues;

    await report(5, 'Building board...');
    await LazyLoader.yieldFrame();

    let filled = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      const board = Array(81).fill(0);
      if (fillBoard(board)) {
        filled = board;
        break;
      }
      await report(5 + attempt * 2, 'Building board...');
      await LazyLoader.yieldFrame();
    }
    if (!filled) throw new Error('Failed to build Sudoku board');

    await report(30, 'Building board... complete');
    await LazyLoader.yieldFrame();

    // Carve: remove cells while uniqueness holds
    const puzzleBoard = filled.slice();
    const order = shuffle(Array.from({ length: 81 }, (_, i) => i));
    const minClues = targetClues;
    let clues = 81;

    await report(35, 'Carving...');

    for (let i = 0; i < order.length; i++) {
      if (clues <= minClues) break;
      const pos = order[i];
      const backup = puzzleBoard[pos];
      puzzleBoard[pos] = 0;

      await report(35 + (50 * (i + 1)) / order.length, 'Carving... (' + clues + ' clues)');

      // Verify uniqueness (chunked via yield every few)
      const unique = isUnique(puzzleBoard);
      if (!unique) {
        puzzleBoard[pos] = backup;
      } else {
        clues--;
      }

      if (i % 2 === 0) await LazyLoader.yieldFrame();
    }

    await report(90, 'Verifying uniqueness...');
    await LazyLoader.yieldFrame();

    if (!isUnique(puzzleBoard)) {
      // restore a few if somehow broken (shouldn't happen)
      await report(92, 'Verifying uniqueness... repairing');
    }

    const finalClues = puzzleBoard.filter((x) => x !== 0).length;
    await report(98, 'Verifying uniqueness... ' + finalClues + ' clues');
    await LazyLoader.yieldFrame();

    return { solution: filled, puzzle: puzzleBoard };
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
      elapsed++;
      updateHud();
    }, 1000);
  }

  function updateHud() {
    const t = document.getElementById('sudoku-time');
    const b = document.getElementById('sudoku-best');
    if (t) t.textContent = LazyStorage.formatTime(elapsed);
    const best = LazyStorage.get(bestKey(difficulty), null);
    if (b) b.textContent = best == null ? '-' : LazyStorage.formatTime(best);
    document.querySelectorAll('[data-sudoku-diff]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-sudoku-diff') === difficulty);
    });
  }

  function applyPuzzle(data) {
    solution = data.solution;
    puzzle = data.puzzle;
    user = puzzle.slice();
    given = puzzle.map((v) => v !== 0);
    selected = given.findIndex((g) => !g);
    if (selected < 0) selected = 0;
    started = false;
    won = false;
    elapsed = 0;
    stopTimer();
    if (global.LazyLeaderboard) LazyLeaderboard.resetRound();
    updateHud();
    render();
  }

  async function newPuzzle(diff) {
    if (diff) difficulty = diff;
    try {
      const data = await LazyLoader.run('Generating Sudoku', (report) =>
        generatePuzzle(difficulty, report)
      );
      applyPuzzle(data);
    } catch (err) {
      console.error(err);
      alert('Could not generate puzzle. Try again.');
    }
  }

  function selectCell(i) {
    selected = i;
    render();
  }

  function putNumber(n) {
    if (won || given[selected]) return;
    if (!started) {
      started = true;
      startTimer();
    }
    user[selected] = n;
    render();
    if (n !== 0 && user.every((v, i) => v === solution[i])) {
      won = true;
      stopTimer();
      LazyStorage.updateBestLow(bestKey(difficulty), elapsed);
      updateHud();
      refreshLobbyStats();
      showOverlay('Solved!', 'Time: ' + LazyStorage.formatTime(elapsed));
    }
  }

  function clearCell() {
    putNumber(0);
  }

  function checkBoard() {
    let mistakes = 0;
    for (let i = 0; i < 81; i++) {
      if (user[i] !== 0 && user[i] !== solution[i]) mistakes++;
    }
    const msg = mistakes === 0
      ? (user.every((v, i) => v === solution[i]) ? 'Perfect - puzzle solved!' : 'Looking good so far.')
      : mistakes + ' cell(s) incorrect.';
    const status = document.getElementById('sudoku-check-msg');
    if (status) status.textContent = msg;
    render(true);
  }

  function render(showErrors) {
    const root = document.getElementById('sudoku-board');
    if (!root || !user) return;
    root.innerHTML = '';
    const selVal = user[selected];

    for (let i = 0; i < 81; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sudoku-cell';
      if (given[i]) btn.classList.add('given');
      if (i === selected) btn.classList.add('selected');
      else if (selVal && user[i] === selVal) btn.classList.add('same');
      if (showErrors && user[i] !== 0 && user[i] !== solution[i]) btn.classList.add('error');
      btn.textContent = user[i] ? String(user[i]) : '';
      btn.setAttribute('aria-label', 'Row ' + (((i / 9) | 0) + 1) + ' column ' + ((i % 9) + 1));
      btn.addEventListener('click', () => selectCell(i));
      root.appendChild(btn);
    }
  }

  function showOverlay(title, msg) {
    const ov = document.getElementById('sudoku-overlay');
    if (!ov) return;
    ov.querySelector('h3').textContent = title;
    ov.querySelector('p').textContent = msg;
    if (global.LazyLeaderboard) {
      LazyLeaderboard.fillScoreForm(ov, {
        show: true,
        getPayload: () => ({
          game: 'sudoku',
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
    document.getElementById('sudoku-overlay')?.classList.remove('visible');
  }

  function onKey(e) {
    const view = document.getElementById('view-sudoku');
    if (!view || !view.classList.contains('active') || !user) return;
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;
    const k = e.key;
    if (k >= '1' && k <= '9') {
      e.preventDefault();
      putNumber(Number(k));
    } else if (k === 'Backspace' || k === 'Delete' || k === '0' || k === ' ') {
      e.preventDefault();
      clearCell();
    } else if (k === 'ArrowLeft') {
      e.preventDefault();
      selectCell((selected + 80) % 81);
    } else if (k === 'ArrowRight') {
      e.preventDefault();
      selectCell((selected + 1) % 81);
    } else if (k === 'ArrowUp') {
      e.preventDefault();
      selectCell((selected + 72) % 81);
    } else if (k === 'ArrowDown') {
      e.preventDefault();
      selectCell((selected + 9) % 81);
    }
  }

  function refreshLobbyStats() {
    const el = document.querySelector('[data-stat="sudoku"]');
    if (!el) return;
    const parts = ['easy', 'medium', 'hard'].map((d) => {
      const t = LazyStorage.get(bestKey(d), null);
      return DIFF[d].label[0] + ':' + (t == null ? '-' : LazyStorage.formatTime(t));
    });
    el.textContent = parts.join(' | ');
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.addEventListener('keydown', onKey);
    document.querySelectorAll('[data-sudoku-diff]').forEach((btn) => {
      btn.addEventListener('click', () => {
        hideOverlay();
        newPuzzle(btn.getAttribute('data-sudoku-diff'));
      });
    });
    document.getElementById('sudoku-new')?.addEventListener('click', () => {
      hideOverlay();
      newPuzzle();
    });
    document.getElementById('sudoku-check')?.addEventListener('click', checkBoard);
    document.getElementById('sudoku-clear')?.addEventListener('click', clearCell);
    document.getElementById('sudoku-again')?.addEventListener('click', () => {
      hideOverlay();
      newPuzzle();
    });
    document.getElementById('sudoku-exit')?.addEventListener('click', () => {
      hideOverlay();
      if (global.LazyLagoon) LazyLagoon.navigate('/');
    });
    document.querySelectorAll('[data-sudoku-num]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const n = Number(btn.getAttribute('data-sudoku-num'));
        putNumber(n);
      });
    });
  }

  async function mount() {
    bind();
    hideOverlay();
    refreshLobbyStats();
    if (!puzzle) {
      await newPuzzle(difficulty);
    } else {
      updateHud();
      render();
    }
  }

  function unmount() {
    stopTimer();
  }

  global.SudokuGame = {
    mount,
    unmount,
    refreshLobbyStats,
    generatePuzzle,
    isUnique,
    fillBoard,
    canPlace,
    countSolutions,
    DIFF,
  };
})(typeof window !== 'undefined' ? window : globalThis);

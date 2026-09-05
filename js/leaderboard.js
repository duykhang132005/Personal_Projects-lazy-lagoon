/* Lazy Lagoon - device-local leaderboard (localStorage only) */
(function (global) {
  const STORAGE_KEY = 'leaderboard.local';
  const LEGACY_PENDING_KEY = 'leaderboard.pending';
  const LEGACY_KEY = 'leaderboard';
  const MAX_NAME = 16;
  const MAX_ENTRIES = 10;
  const GAMES = ['snake', 'minesweeper', 'tictactoe', 'sudoku'];
  const DIFFS = ['easy', 'medium', 'hard'];

  let boardCache = null;
  let roundSubmitted = false;
  let uiState = { game: 'snake', difficulty: 'easy' };

  function emptyBoard() {
    return {
      snake: [],
      minesweeper: { easy: [], medium: [], hard: [] },
      sudoku: { easy: [], medium: [], hard: [] },
      tictactoe: [],
    };
  }

  function sanitizeName(raw) {
    let s = String(raw == null ? '' : raw);
    s = s.replace(/<[^>]*>/g, '');
    s = s.replace(/[<>&"'`]/g, '');
    s = s.trim().replace(/\s+/g, ' ');
    if (s.length > MAX_NAME) s = s.slice(0, MAX_NAME);
    return s || 'Anon';
  }

  function lowerBetter(game) {
    return game === 'minesweeper' || game === 'sudoku';
  }

  function needsDifficulty(game) {
    return game === 'minesweeper' || game === 'sudoku';
  }

  function normalizeEntry(raw, game) {
    if (!raw || typeof raw !== 'object') return null;
    const score = Number(raw.score);
    if (!Number.isFinite(score)) return null;
    const entry = {
      name: sanitizeName(raw.name),
      score,
      at: typeof raw.at === 'string' && raw.at ? raw.at : new Date().toISOString(),
    };
    if (game === 'tictactoe' || raw.mode) {
      const mode = String(raw.mode || raw.difficulty || '').toLowerCase();
      if (mode === 'pvp' || mode === 'pvai') entry.mode = mode;
      else if (raw.note) entry.note = String(raw.note).slice(0, 32);
    }
    return entry;
  }

  function sortList(game, list) {
    const arr = (list || []).slice();
    if (game === 'tictactoe') {
      arr.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    } else if (lowerBetter(game)) {
      arr.sort((a, b) => a.score - b.score);
    } else {
      arr.sort((a, b) => b.score - a.score);
    }
    return arr.slice(0, MAX_ENTRIES);
  }

  function normalizeBoard(data) {
    const board = emptyBoard();
    if (!data || typeof data !== 'object' || Array.isArray(data)) return board;

    if (Array.isArray(data.snake)) {
      board.snake = sortList(
        'snake',
        data.snake.map((e) => normalizeEntry(e, 'snake')).filter(Boolean)
      );
    }

    ['minesweeper', 'sudoku'].forEach((game) => {
      const src = data[game];
      if (!src || typeof src !== 'object' || Array.isArray(src)) return;
      DIFFS.forEach((d) => {
        if (!Array.isArray(src[d])) return;
        board[game][d] = sortList(
          game,
          src[d].map((e) => normalizeEntry(e, game)).filter(Boolean)
        );
      });
    });

    if (Array.isArray(data.tictactoe)) {
      board.tictactoe = sortList(
        'tictactoe',
        data.tictactoe.map((e) => normalizeEntry(e, 'tictactoe')).filter(Boolean)
      );
    }

    return board;
  }

  function cloneBoard(board) {
    return JSON.parse(JSON.stringify(board || emptyBoard()));
  }

  function getList(board, game, difficulty) {
    if (!board) return [];
    if (needsDifficulty(game)) {
      const bag = board[game];
      if (!bag || typeof bag !== 'object') return [];
      const d = DIFFS.includes(difficulty) ? difficulty : 'easy';
      return Array.isArray(bag[d]) ? bag[d] : [];
    }
    return Array.isArray(board[game]) ? board[game] : [];
  }

  function setList(board, game, difficulty, list) {
    const sorted = sortList(game, list);
    if (needsDifficulty(game)) {
      if (!board[game] || typeof board[game] !== 'object') {
        board[game] = { easy: [], medium: [], hard: [] };
      }
      const d = DIFFS.includes(difficulty) ? difficulty : 'easy';
      board[game][d] = sorted;
    } else {
      board[game] = sorted;
    }
    return sorted;
  }

  function qualifies(board, game, difficulty, score) {
    const list = getList(board, game, difficulty);
    if (game === 'tictactoe') return true;
    if (list.length < MAX_ENTRIES) return true;
    const nth = list[MAX_ENTRIES - 1];
    if (!nth) return true;
    if (lowerBetter(game)) return score < nth.score;
    return score > nth.score;
  }

  function insertEntry(board, game, difficulty, entry) {
    const list = getList(board, game, difficulty).slice();
    list.push(entry);
    return setList(board, game, difficulty, list);
  }

  function loadBoard() {
    if (boardCache) return cloneBoard(boardCache);

    let raw = LazyStorage.get(STORAGE_KEY, null);
    if (!raw) {
      // One-time migrate from the old pending key (worker-era local overlay)
      raw = LazyStorage.get(LEGACY_PENDING_KEY, null);
      if (raw) {
        LazyStorage.set(STORAGE_KEY, raw);
        try {
          LazyStorage.set(LEGACY_PENDING_KEY, null);
        } catch {
          /* ignore */
        }
      }
    }

    boardCache = normalizeBoard(raw);
    return cloneBoard(boardCache);
  }

  function saveBoard(board) {
    const normalized = normalizeBoard(board);
    LazyStorage.set(STORAGE_KEY, normalized);
    boardCache = cloneBoard(normalized);
    try {
      LazyStorage.set(LEGACY_KEY, null);
      LazyStorage.set(LEGACY_PENDING_KEY, null);
    } catch {
      /* ignore */
    }
    return cloneBoard(boardCache);
  }

  async function fetchBoard() {
    return loadBoard();
  }

  function formatScore(game, entry) {
    if (!entry) return '-';
    if (game === 'minesweeper' || game === 'sudoku') {
      return LazyStorage.formatTime(entry.score);
    }
    if (game === 'tictactoe') {
      const mode = entry.mode ? ' · ' + entry.mode.toUpperCase() : '';
      return 'Win' + mode;
    }
    return String(entry.score) + ' pts';
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  }

  function resetRound() {
    roundSubmitted = false;
  }

  function wasSubmittedThisRound() {
    return roundSubmitted;
  }

  /**
   * @param {{ name, game, score, difficulty?, mode?, metric?, unit? }} payload
   */
  async function submit(payload) {
    if (roundSubmitted) {
      return { ok: false, already: true, message: 'Already submitted this round.' };
    }

    const game = String(payload.game || '');
    if (!GAMES.includes(game)) {
      return { ok: false, message: 'Unknown game.' };
    }

    const difficulty = needsDifficulty(game)
      ? String(payload.difficulty || 'easy').toLowerCase()
      : undefined;
    if (needsDifficulty(game) && !DIFFS.includes(difficulty)) {
      return { ok: false, message: 'Invalid difficulty.' };
    }

    const score = Number(payload.score);
    if (!Number.isFinite(score)) {
      return { ok: false, message: 'Invalid score.' };
    }

    const board = loadBoard();
    if (!qualifies(board, game, difficulty, score)) {
      return {
        ok: false,
        worthy: false,
        message: 'Not a top-10 score — keep playing!',
      };
    }

    const entry = normalizeEntry(
      {
        name: payload.name,
        score: game === 'tictactoe' ? 1 : score,
        at: new Date().toISOString(),
        mode: payload.mode || payload.difficulty,
      },
      game
    );
    if (!entry) return { ok: false, message: 'Invalid score.' };

    insertEntry(board, game, difficulty, entry);
    saveBoard(board);
    roundSubmitted = true;

    return {
      ok: true,
      entry,
      local: true,
      message: 'Saved on this device.',
    };
  }

  function fillScoreForm(root, opts) {
    if (!root) return;
    const form = root.querySelector('[data-score-form]');
    if (!form) return;
    const show = opts && opts.show !== false;
    form.hidden = !show;
    if (!show) return;

    resetRound();
    const input = form.querySelector('.score-name');
    const msg = form.querySelector('.score-submit-msg');
    const btn = form.querySelector('[data-submit-score]');
    if (input) input.value = '';
    if (msg) {
      msg.hidden = true;
      msg.textContent = '';
    }
    if (btn) btn.disabled = false;

    form._scoreOpts = opts;
  }

  function bindScoreForms(doc) {
    (doc || document).querySelectorAll('[data-score-form]').forEach((form) => {
      if (form.dataset.bound) return;
      form.dataset.bound = '1';
      const btn = form.querySelector('[data-submit-score]');
      btn?.addEventListener('click', async () => {
        const opts = form._scoreOpts;
        if (!opts || typeof opts.getPayload !== 'function') return;
        const msg = form.querySelector('.score-submit-msg');
        if (roundSubmitted) {
          if (msg) {
            msg.hidden = false;
            msg.textContent = 'Already submitted this round.';
          }
          return;
        }
        const name = form.querySelector('.score-name')?.value;
        const base = opts.getPayload();
        if (!base) return;
        btn.disabled = true;
        const result = await submit({ ...base, name });
        if (msg) {
          msg.hidden = false;
          msg.textContent = result.message || (result.ok ? 'Saved.' : 'Could not save.');
        }
        if (result.ok) {
          // Keep button disabled after success
        } else if (!result.already) {
          btn.disabled = false;
        }
        if (result.ok) {
          const ov = document.getElementById('lb-overlay');
          if (ov && ov.classList.contains('visible')) renderModal();
        }
      });
    });
  }

  function gameTitle(id) {
    return (
      {
        snake: 'Snake',
        minesweeper: 'Minesweeper',
        tictactoe: 'Tic-Tac-Toe',
        sudoku: 'Sudoku',
      }[id] || id
    );
  }

  function renderTable(game, list) {
    const wrap = document.createElement('div');
    wrap.className = 'lb-table-wrap';
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'No scores yet — be the first!';
      wrap.appendChild(empty);
      return wrap;
    }

    const table = document.createElement('table');
    table.className = 'lb-table';
    table.innerHTML =
      '<thead><tr>' +
      '<th scope="col">#</th>' +
      '<th scope="col">Name</th>' +
      '<th scope="col">' +
      (lowerBetter(game) ? 'Time' : game === 'tictactoe' ? 'Result' : 'Score') +
      '</th>' +
      '<th scope="col">Date</th>' +
      '</tr></thead>';
    const tbody = document.createElement('tbody');
    list.forEach((e, i) => {
      const tr = document.createElement('tr');
      const rank = document.createElement('td');
      rank.className = 'lb-rank';
      rank.textContent = String(i + 1);
      const name = document.createElement('td');
      name.className = 'lb-name';
      name.textContent = e.name;
      const score = document.createElement('td');
      score.className = 'lb-score';
      score.textContent = formatScore(game, e);
      const date = document.createElement('td');
      date.className = 'lb-date';
      date.textContent = formatDate(e.at);
      tr.appendChild(rank);
      tr.appendChild(name);
      tr.appendChild(score);
      tr.appendChild(date);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function syncTabButtons(root) {
    root.querySelectorAll('[data-lb-game]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-lb-game') === uiState.game);
    });
    const sub = root.querySelector('.lb-subtabs');
    if (sub) {
      const show = needsDifficulty(uiState.game);
      sub.hidden = !show;
      sub.querySelectorAll('[data-lb-diff]').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-lb-diff') === uiState.difficulty);
      });
    }
  }

  async function renderModal() {
    const body = document.getElementById('lb-modal-body');
    if (!body) return;

    if (!body.dataset.built) {
      body.dataset.built = '1';
      body.innerHTML =
        '<div class="lb-tabs diff-group" role="tablist" aria-label="Game">' +
        GAMES.map(
          (g) =>
            '<button type="button" class="btn btn-sm" role="tab" data-lb-game="' +
            g +
            '">' +
            gameTitle(g) +
            '</button>'
        ).join('') +
        '</div>' +
        '<div class="lb-subtabs diff-group" role="tablist" aria-label="Difficulty" hidden>' +
        DIFFS.map(
          (d) =>
            '<button type="button" class="btn btn-sm" data-lb-diff="' +
            d +
            '">' +
            d.charAt(0).toUpperCase() +
            d.slice(1) +
            '</button>'
        ).join('') +
        '</div>' +
        '<div class="lb-panel" data-lb-panel></div>' +
        '<p class="hint lb-note" data-lb-note></p>';

      body.querySelectorAll('[data-lb-game]').forEach((btn) => {
        btn.addEventListener('click', () => {
          uiState.game = btn.getAttribute('data-lb-game');
          if (needsDifficulty(uiState.game) && !DIFFS.includes(uiState.difficulty)) {
            uiState.difficulty = 'easy';
          }
          renderModal();
        });
      });
      body.querySelectorAll('[data-lb-diff]').forEach((btn) => {
        btn.addEventListener('click', () => {
          uiState.difficulty = btn.getAttribute('data-lb-diff');
          renderModal();
        });
      });
    }

    const panel = body.querySelector('[data-lb-panel]');
    const note = body.querySelector('[data-lb-note]');
    syncTabButtons(body);

    const board = loadBoard();
    const list = getList(board, uiState.game, uiState.difficulty);
    panel.innerHTML = '';
    panel.appendChild(renderTable(uiState.game, list));

    note.textContent = 'Top 10 on this device (browser storage).';
  }

  function showModal() {
    const ov = document.getElementById('lb-overlay');
    if (!ov) return;
    ov.classList.add('visible');
    ov.setAttribute('aria-hidden', 'false');
    renderModal();
  }

  function hideModal() {
    const ov = document.getElementById('lb-overlay');
    if (!ov) return;
    ov.classList.remove('visible');
    ov.setAttribute('aria-hidden', 'true');
  }

  function bindUi() {
    document.getElementById('btn-leaderboard')?.addEventListener('click', showModal);
    document.getElementById('lb-close')?.addEventListener('click', hideModal);
    document.getElementById('lb-refresh')?.addEventListener('click', () => {
      boardCache = null;
      renderModal();
    });
    document.getElementById('lb-overlay')?.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'lb-overlay') hideModal();
    });
    bindScoreForms(document);
  }

  function scoreFormHtml() {
    return (
      '<div class="score-submit" data-score-form hidden>' +
      '<label class="score-label">Name (optional)' +
      '<input type="text" class="score-name" maxlength="16" autocomplete="nickname" placeholder="Your name" />' +
      '</label>' +
      '<button type="button" class="btn" data-submit-score>Submit score</button>' +
      '<p class="score-submit-msg hint" hidden></p>' +
      '</div>'
    );
  }

  global.LazyLeaderboard = {
    sanitizeName,
    submit,
    qualifies,
    resetRound,
    wasSubmittedThisRound,
    fillScoreForm,
    bindScoreForms,
    bindUi,
    showModal,
    hideModal,
    renderModal,
    fetchBoard,
    emptyBoard,
    normalizeBoard,
    scoreFormHtml,
  };
})(typeof window !== 'undefined' ? window : globalThis);

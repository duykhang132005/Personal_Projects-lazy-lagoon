/* Lazy Lagoon - Tic-Tac-Toe with magic-square win detection
 * Board mapping (Lo Shu):
 *   2 7 6
 *   9 5 1
 *   4 3 8
 * A player wins if any 3 of their numbers sum to 15.
 */
(function (global) {
  // index 0..8 left-to-right, top-to-bottom
  const MAGIC = [2, 7, 6, 9, 5, 1, 4, 3, 8];
  const WIN_SUM = 15;

  let board; // null | 'X' | 'O'
  let turn; // 'X' | 'O'
  let mode; // 'pvp' | 'pvai'
  let over;
  let winCells;
  let bound = false;
  let aiThinking = false;
  let lastResult = null; // 'X' | 'O' | 'draw'

  function emptyBoard() {
    return Array(9).fill(null);
  }

  /** Numbers claimed by player */
  function numbersFor(player) {
    const nums = [];
    for (let i = 0; i < 9; i++) {
      if (board[i] === player) nums.push(MAGIC[i]);
    }
    return nums;
  }

  /**
   * Win if any 3 of player's magic numbers sum to 15.
   * Returns winning cell indices or null.
   */
  function findWin(player) {
    const idxs = [];
    for (let i = 0; i < 9; i++) if (board[i] === player) idxs.push(i);
    if (idxs.length < 3) return null;
    for (let a = 0; a < idxs.length; a++) {
      for (let b = a + 1; b < idxs.length; b++) {
        for (let c = b + 1; c < idxs.length; c++) {
          const i = idxs[a], j = idxs[b], k = idxs[c];
          if (MAGIC[i] + MAGIC[j] + MAGIC[k] === WIN_SUM) {
            return [i, j, k];
          }
        }
      }
    }
    return null;
  }

  function isDraw() {
    return board.every((c) => c != null) && !findWin('X') && !findWin('O');
  }

  function statusText() {
    const el = document.getElementById('ttt-status');
    if (!el) return;
    if (over) {
      const wx = findWin('X');
      const wo = findWin('O');
      if (wx) el.textContent = mode === 'pvai' ? 'You win!' : 'X wins!';
      else if (wo) el.textContent = mode === 'pvai' ? 'AI wins!' : 'O wins!';
      else el.textContent = "It's a draw.";
    } else if (aiThinking) {
      el.textContent = 'AI thinking...';
    } else {
      el.textContent = (mode === 'pvai' && turn === 'O' ? 'AI' : turn) + "'s turn";
    }
  }

  function endGame(result) {
    over = true;
    lastResult = result;
    render();
    let title = 'Game Over';
    let msg = "It's a draw.";
    let canSubmit = false;
    if (result === 'X') {
      title = mode === 'pvai' ? 'You win!' : 'X wins!';
      msg = mode === 'pvai' ? 'Nice play against the AI.' : 'X takes the round.';
      canSubmit = true;
    } else if (result === 'O') {
      title = mode === 'pvai' ? 'AI wins!' : 'O wins!';
      msg = mode === 'pvai' ? 'The AI got this one.' : 'O takes the round.';
      canSubmit = mode === 'pvp';
    } else {
      title = 'Draw';
      msg = 'No winner this round.';
    }
    showOverlay(title, msg, canSubmit, result);
  }

  function showOverlay(title, msg, canSubmit, result) {
    const ov = document.getElementById('ttt-overlay');
    if (!ov) return;
    ov.querySelector('h3').textContent = title;
    ov.querySelector('p').textContent = msg;
    if (global.LazyLeaderboard) {
      LazyLeaderboard.fillScoreForm(ov, {
        show: !!canSubmit,
        getPayload: () => ({
          game: 'tictactoe',
          score: 1,
          unit: 'win',
          metric: 'score',
          mode: mode,
        }),
      });
    }
    ov.classList.add('visible');
  }

  function hideOverlay() {
    document.getElementById('ttt-overlay')?.classList.remove('visible');
  }

  function render() {
    const root = document.getElementById('ttt-board');
    if (!root) return;
    root.innerHTML = '';
    board.forEach((val, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ttt-cell' + (val === 'O' ? ' o' : '');
      if (winCells && winCells.includes(i)) btn.classList.add('win');
      btn.textContent = val || '';
      btn.disabled = over || val != null || aiThinking || (mode === 'pvai' && turn === 'O');
      btn.setAttribute('aria-label', 'Cell ' + (i + 1) + (val ? ', ' + val : ', empty'));
      btn.addEventListener('click', () => play(i));
      root.appendChild(btn);
    });
    document.querySelectorAll('[data-ttt-mode]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-ttt-mode') === mode);
    });
    statusText();
  }

  function play(i) {
    if (over || aiThinking || board[i] != null) return;
    if (mode === 'pvai' && turn === 'O') return;
    board[i] = turn;
    const w = findWin(turn);
    if (w) {
      winCells = w;
      endGame(turn);
      return;
    }
    if (isDraw()) {
      winCells = null;
      endGame('draw');
      return;
    }
    turn = turn === 'X' ? 'O' : 'X';
    render();
    if (mode === 'pvai' && turn === 'O' && !over) {
      aiThinking = true;
      statusText();
      setTimeout(() => {
        const move = bestAiMove();
        aiThinking = false;
        if (move != null && board[move] == null) {
          board[move] = 'O';
          const wo = findWin('O');
          if (wo) {
            winCells = wo;
            endGame('O');
            return;
          } else if (isDraw()) {
            winCells = null;
            endGame('draw');
            return;
          } else {
            turn = 'X';
          }
        }
        render();
      }, 280);
    }
  }

  /* Minimax - O is maximizer (AI), X is minimizer (human) */
  function evaluate() {
    if (findWin('O')) return 10;
    if (findWin('X')) return -10;
    return 0;
  }

  function minimax(depth, isMax, alpha, beta) {
    const score = evaluate();
    if (score === 10) return score - depth;
    if (score === -10) return score + depth;
    if (board.every((c) => c != null)) return 0;

    if (isMax) {
      let best = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] != null) continue;
        board[i] = 'O';
        best = Math.max(best, minimax(depth + 1, false, alpha, beta));
        board[i] = null;
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
      return best;
    }
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] != null) continue;
      board[i] = 'X';
      best = Math.min(best, minimax(depth + 1, true, alpha, beta));
      board[i] = null;
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  function bestAiMove() {
    let bestScore = -Infinity;
    let move = null;
    const order = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5);
    for (const i of order) {
      if (board[i] != null) continue;
      board[i] = 'O';
      const score = minimax(0, false, -Infinity, Infinity);
      board[i] = null;
      if (score > bestScore) {
        bestScore = score;
        move = i;
      }
    }
    return move;
  }

  function reset() {
    board = emptyBoard();
    turn = 'X';
    over = false;
    winCells = null;
    aiThinking = false;
    lastResult = null;
    if (global.LazyLeaderboard) LazyLeaderboard.resetRound();
    hideOverlay();
    render();
  }

  function setMode(m) {
    mode = m === 'pvai' ? 'pvai' : 'pvp';
    reset();
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.querySelectorAll('[data-ttt-mode]').forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.getAttribute('data-ttt-mode')));
    });
    document.getElementById('ttt-rematch')?.addEventListener('click', reset);
    document.getElementById('ttt-again')?.addEventListener('click', reset);
    document.getElementById('ttt-exit')?.addEventListener('click', () => {
      hideOverlay();
      if (global.LazyLagoon) LazyLagoon.navigate('/');
    });
  }

  function mount() {
    mode = mode || 'pvai';
    bind();
    reset();
  }

  function unmount() {}

  global.TicTacToeGame = {
    mount,
    unmount,
    MAGIC,
    WIN_SUM,
    _testFindWin(b, player) {
      const prev = board;
      board = b;
      const r = findWin(player);
      board = prev;
      return r;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
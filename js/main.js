/* Lazy Lagoon - SPA hash router + lobby */
(function () {
  const ROUTES = {
    '': 'lobby',
    '/': 'lobby',
    '/snake': 'snake',
    '/minesweeper': 'minesweeper',
    '/tictactoe': 'tictactoe',
    '/sudoku': 'sudoku',
    '/memory': 'memory',
    '/2048': '2048',
    '/breakout': 'breakout',
  };

  const TITLES = {
    lobby: 'Lazy Lagoon',
    snake: 'Snake',
    minesweeper: 'Minesweeper',
    tictactoe: 'Tic-Tac-Toe',
    sudoku: 'Sudoku',
    memory: 'Memory Match',
    '2048': '2048',
    breakout: 'Breakout',
  };

  let current = null;

  // Move focus after a view change: back on the lobby, the card of the game just left;
  // in a game, its heading (tabindex=-1, so it is focusable but not in the Tab order).
  function moveFocus(name, prev) {
    let target = null;
    if (name === 'lobby') {
      if (prev && prev !== 'lobby') target = document.querySelector('#view-lobby .game-card[data-route="/' + prev + '"]');
    } else {
      target = document.querySelector('#view-' + name + ' h2');
      if (target && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    }
    if (!target) return;
    try {
      target.focus({ preventScroll: true });
    } catch {
      target.focus();
    }
    if (name === 'lobby' && target.scrollIntoView) target.scrollIntoView({ block: 'nearest' });
  }

  function parseHash() {
    let h = location.hash || '#/';
    if (h.startsWith('#')) h = h.slice(1);
    if (!h.startsWith('/')) h = '/' + h;
    return h.replace(/\/+$/, '') || '/';
  }

  function navigate(path) {
    const p = path.startsWith('/') ? path : '/' + path;
    if (location.hash !== '#' + p) location.hash = '#' + p;
    else route();
  }

  function showView(name) {
    document.querySelectorAll('.view').forEach((v) => {
      v.classList.toggle('active', v.id === 'view-' + name);
      v.setAttribute('aria-hidden', v.id === 'view-' + name ? 'false' : 'true');
    });
    const back = document.getElementById('btn-back');
    if (back) back.hidden = name === 'lobby';
  }

  function unmountCurrent() {
    if (current === 'snake') SnakeGame.unmount();
    else if (current === 'minesweeper') MinesweeperGame.unmount();
    else if (current === 'tictactoe') TicTacToeGame.unmount();
    else if (current === 'sudoku') SudokuGame.unmount();
    else if (current === 'memory') MemoryGame.unmount();
    else if (current === '2048') Twenty48Game.unmount();
    else if (current === 'breakout') BreakoutGame.unmount();
  }

  async function mount(name) {
    if (name === 'snake') SnakeGame.mount();
    else if (name === 'minesweeper') MinesweeperGame.mount();
    else if (name === 'tictactoe') TicTacToeGame.mount();
    else if (name === 'sudoku') await SudokuGame.mount();
    else if (name === 'memory') MemoryGame.mount();
    else if (name === '2048') Twenty48Game.mount();
    else if (name === 'breakout') BreakoutGame.mount();
    else refreshAllStats();
  }

  async function route() {
    const path = parseHash();
    const name = ROUTES[path] || ROUTES[path.toLowerCase()] || 'lobby';
    const prev = current;
    if (current && current !== name) unmountCurrent();
    current = name;
    showView(name);
    document.title = name === 'lobby' ? TITLES.lobby : (TITLES[name] || name) + ' - Lazy Lagoon';
    await mount(name);
    if (prev && prev !== name && current === name) moveFocus(name, prev);
  }

  function refreshAllStats() {
    SnakeGame.refreshLobbyStats();
    MinesweeperGame.refreshLobbyStats();
    SudokuGame.refreshLobbyStats();
    MemoryGame.refreshLobbyStats();
    Twenty48Game.refreshLobbyStats();
    BreakoutGame.refreshLobbyStats();
  }

  // Game overlays are aria-hidden until shown, so a live region inside them would not be
  // announced. Mirror the overlay title and message into one persistent live region instead.
  function bindOverlayAnnouncer() {
    const live = document.getElementById('sr-announcer');
    if (!live || typeof MutationObserver === 'undefined') return;
    let pending = 0;
    const announce = (ov) => {
      const h = ov.querySelector('h3');
      const p = ov.querySelector('p');
      const title = h ? h.textContent.trim() : '';
      const msg = p ? p.textContent.trim() : '';
      let text = title;
      if (msg) text = title ? title + (/[.!?]$/.test(title) ? ' ' : '. ') + msg : msg;
      if (!text) return;
      live.textContent = '';
      clearTimeout(pending);
      pending = setTimeout(() => { live.textContent = text; }, 60);
    };
    const obs = new MutationObserver((records) => {
      records.forEach((r) => {
        const ov = r.target;
        if (ov.getAttribute('aria-hidden') === 'false' && r.oldValue !== 'false') announce(ov);
      });
    });
    document.querySelectorAll('.overlay').forEach((ov) => {
      if (ov.id === 'loader-overlay' || ov.id === 'lb-overlay') return;
      obs.observe(ov, { attributes: true, attributeFilter: ['aria-hidden'], attributeOldValue: true });
    });
  }

  function bindLobby() {
    document.querySelectorAll('[data-route]').forEach((el) => {
      el.addEventListener('click', () => navigate(el.getAttribute('data-route')));
    });
    document.getElementById('btn-back')?.addEventListener('click', () => navigate('/'));
    document.getElementById('brand-home')?.addEventListener('click', () => navigate('/'));
  }

  // "Updated" toast: shown only when a NEW service worker takes over a page that was
  // already controlled (never on the first install), at most once per page. No auto-reload.
  let updateToastShown = false;

  function showUpdateToast() {
    if (updateToastShown || document.getElementById('update-toast')) return;
    updateToastShown = true;
    const toast = document.createElement('div');
    toast.id = 'update-toast';
    toast.className = 'update-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);

    const reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'update-toast-reload';
    reload.textContent = 'Updated. Tap to reload.';
    reload.addEventListener('click', () => location.reload());

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'update-toast-close';
    close.setAttribute('aria-label', 'Dismiss update notice');
    close.textContent = '\u00d7';
    const dismiss = () => toast.remove();
    close.addEventListener('click', dismiss);
    toast.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') dismiss();
    });

    // Fill the live region after it is in the DOM so screen readers announce it.
    setTimeout(() => {
      toast.appendChild(reload);
      toast.appendChild(close);
    }, 50);
  }

  // Offline play: only over http(s), never from file://. Failure is harmless (the site still works).
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) showUpdateToast();
    });
    const go = () => {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch((err) => {
        console.warn('Lazy Lagoon: offline support unavailable.', err && err.message ? err.message : err);
      });
    };
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
  }

  async function init() {
    LazyLoader.init();
    registerServiceWorker();
    if (window.LazyLeaderboard) {
      await LazyLeaderboard.loadSeed();
      LazyLeaderboard.bindUi();
    }
    bindLobby();
    bindOverlayAnnouncer();
    window.addEventListener('hashchange', () => { route(); });
    refreshAllStats();
    route();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); });
  } else {
    init();
  }

  window.LazyLagoon = { navigate, route };
})();

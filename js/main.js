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

  let current = null;

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
    if (current && current !== name) unmountCurrent();
    current = name;
    showView(name);
    await mount(name);
    document.title =
      name === 'lobby'
        ? 'Lazy Lagoon'
        : name.charAt(0).toUpperCase() + name.slice(1) + ' - Lazy Lagoon';
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

  async function init() {
    LazyLoader.init();
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

/* Lazy Lagoon - SPA hash router + lobby */
(function () {
  const ROUTES = {
    '': 'lobby',
    '/': 'lobby',
    '/snake': 'snake',
    '/minesweeper': 'minesweeper',
    '/tictactoe': 'tictactoe',
    '/sudoku': 'sudoku',
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
  }

  async function mount(name) {
    if (name === 'snake') SnakeGame.mount();
    else if (name === 'minesweeper') MinesweeperGame.mount();
    else if (name === 'tictactoe') TicTacToeGame.mount();
    else if (name === 'sudoku') await SudokuGame.mount();
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
  }

  function bindLobby() {
    document.querySelectorAll('[data-route]').forEach((el) => {
      el.addEventListener('click', () => navigate(el.getAttribute('data-route')));
    });
    document.getElementById('btn-back')?.addEventListener('click', () => navigate('/'));
    document.getElementById('brand-home')?.addEventListener('click', () => navigate('/'));
  }

  function init() {
    LazyLoader.init();
    if (window.LazyLeaderboard) LazyLeaderboard.bindUi();
    bindLobby();
    window.addEventListener('hashchange', () => { route(); });
    refreshAllStats();
    route();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.LazyLagoon = { navigate, route };
})();

/* Lazy Lagoon - Snake */
(function (global) {
  const COLS = 20;
  const ROWS = 20;
  const BEST_KEY = 'snake.best';

  let canvas, ctx, wrap;
  let snake, dir, nextDir, food, score, best, tickMs, timer, running, paused, dead;
  let cellSize = 20;
  let boundKeys = false;
  let reducedMotion = false;

  function $(sel) { return document.querySelector(sel); }

  function initDom() {
    canvas = document.getElementById('snake-canvas');
    wrap = document.getElementById('view-snake');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    try {
      reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { /* */ }
  }

  function resize() {
    if (!canvas) return;
    const css = Math.min(400, canvas.parentElement ? canvas.parentElement.clientWidth : 400);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = COLS * cellSize * dpr;
    canvas.height = ROWS * cellSize * dpr;
    canvas.style.width = css + 'px';
    canvas.style.height = css + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function randFood() {
    let p;
    do {
      p = { x: (Math.random() * COLS) | 0, y: (Math.random() * ROWS) | 0 };
    } while (snake.some((s) => s.x === p.x && s.y === p.y));
    return p;
  }

  function reset() {
    clearInterval(timer);
    timer = null;
    snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    food = randFood();
    score = 0;
    tickMs = 140;
    running = false;
    paused = false;
    dead = false;
    best = LazyStorage.getNumber(BEST_KEY, 0);
    if (global.LazyLeaderboard) LazyLeaderboard.resetRound();
    updateHud();
    hideOverlay();
    draw();
  }

  function updateHud() {
    const s = document.getElementById('snake-score');
    const b = document.getElementById('snake-best');
    if (s) s.textContent = String(score);
    if (b) b.textContent = String(best);
  }

  function setDir(nx, ny) {
    if (dead || paused) return;
    // no reverse
    if (nx === -dir.x && ny === -dir.y) return;
    if (nx === 0 && ny === 0) return;
    nextDir = { x: nx, y: ny };
    if (!running && !dead) start();
  }

  function start() {
    if (dead) return;
    running = true;
    paused = false;
    clearInterval(timer);
    timer = setInterval(tick, tickMs);
    hideOverlay();
  }

  function pause() {
    if (!running || dead) return;
    paused = !paused;
    if (paused) {
      clearInterval(timer);
      showOverlay('Paused', 'Press Space or Resume to continue.', true);
    } else {
      hideOverlay();
      timer = setInterval(tick, tickMs);
    }
  }

  function gameOver() {
    dead = true;
    running = false;
    clearInterval(timer);
    best = LazyStorage.updateBestHigh(BEST_KEY, score);
    updateHud();
    refreshLobbyStats();
    showOverlay('Game Over', 'Score: ' + score + (score >= best ? ' - New best!' : ''), false);
  }

  function tick() {
    if (paused || dead) return;
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) {
      gameOver();
      return;
    }
    if (snake.some((s) => s.x === head.x && s.y === head.y)) {
      gameOver();
      return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      food = randFood();
      if (tickMs > 60) {
        tickMs = Math.max(60, tickMs - 4);
        clearInterval(timer);
        timer = setInterval(tick, tickMs);
      }
      updateHud();
    } else {
      snake.pop();
    }
    draw();
  }

  function draw() {
    if (!ctx) return;
    const w = COLS * cellSize;
    const h = ROWS * cellSize;
    ctx.fillStyle = '#020c10';
    ctx.fillRect(0, 0, w, h);

    // subtle grid
    ctx.strokeStyle = 'rgba(57,255,20,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= COLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, h);
      ctx.stroke();
    }
    for (let j = 0; j <= ROWS; j++) {
      ctx.beginPath();
      ctx.moveTo(0, j * cellSize);
      ctx.lineTo(w, j * cellSize);
      ctx.stroke();
    }

    // food
    ctx.fillStyle = '#39ff14';
    if (!reducedMotion) {
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = 10;
    }
    const pad = 3;
    ctx.fillRect(food.x * cellSize + pad, food.y * cellSize + pad, cellSize - pad * 2, cellSize - pad * 2);
    ctx.shadowBlur = 0;

    // snake
    snake.forEach((seg, i) => {
      const t = i / Math.max(1, snake.length - 1);
      const g = Math.floor(255 - t * 120);
      ctx.fillStyle = i === 0 ? '#b8ff9a' : `rgb(20,${g},40)`;
      if (i === 0 && !reducedMotion) {
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 8;
      }
      ctx.fillRect(seg.x * cellSize + 1, seg.y * cellSize + 1, cellSize - 2, cellSize - 2);
      ctx.shadowBlur = 0;
    });
  }

  function showOverlay(title, msg, isPause) {
    const ov = document.getElementById('snake-overlay');
    if (!ov) return;
    ov.querySelector('h3').textContent = title;
    ov.querySelector('p').textContent = msg;
    const resume = document.getElementById('snake-resume');
    if (resume) resume.style.display = isPause ? '' : 'none';
    const again = document.getElementById('snake-again');
    if (again) again.style.display = isPause ? 'none' : '';
    const exitBtn = document.getElementById('snake-exit');
    if (exitBtn) exitBtn.style.display = isPause ? 'none' : '';
    if (global.LazyLeaderboard) {
      LazyLeaderboard.fillScoreForm(ov, {
        show: !isPause,
        getPayload: () => ({
          game: 'snake',
          score: score,
          unit: 'pts',
          metric: 'score',
        }),
      });
    }
    ov.classList.add('visible');
  }

  function hideOverlay() {
    const ov = document.getElementById('snake-overlay');
    if (ov) ov.classList.remove('visible');
  }

  function onKey(e) {
    if (!wrap || !wrap.classList.contains('active')) return;
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(k) || e.code === 'Space') {
      e.preventDefault();
    }
    if (k === 'arrowup' || k === 'w') setDir(0, -1);
    else if (k === 'arrowdown' || k === 's') setDir(0, 1);
    else if (k === 'arrowleft' || k === 'a') setDir(-1, 0);
    else if (k === 'arrowright' || k === 'd') setDir(1, 0);
    else if (k === ' ' || e.code === 'Space') {
      if (dead) { reset(); }
      else if (!running) { /* wait for arrow/WASD/D-pad - same as Play Again */ }
      else pause();
    }
  }

  function bind() {
    if (boundKeys) return;
    boundKeys = true;
    document.addEventListener('keydown', onKey);
    // Restart / Play Again: reset board but do NOT start tick until first direction input
    document.getElementById('snake-restart')?.addEventListener('click', () => { reset(); });
    document.getElementById('snake-pause')?.addEventListener('click', () => {
      if (!running && !dead) return;
      else pause();
    });
    document.getElementById('snake-resume')?.addEventListener('click', () => {
      if (paused) pause();
    });
    document.getElementById('snake-again')?.addEventListener('click', () => { reset(); });
    document.getElementById('snake-exit')?.addEventListener('click', () => {
      hideOverlay();
      if (global.LazyLagoon) LazyLagoon.navigate('/');
    });
    wrap?.querySelectorAll('[data-dir]').forEach((btn) => {
      const go = (e) => {
        e.preventDefault();
        const [x, y] = btn.getAttribute('data-dir').split(',').map(Number);
        setDir(x, y);
      };
      btn.addEventListener('click', go);
      btn.addEventListener('touchstart', go, { passive: false });
    });
    window.addEventListener('resize', () => { resize(); draw(); });
  }

  function refreshLobbyStats() {
    const el = document.querySelector('[data-stat="snake"]');
    if (el) el.textContent = 'Best: ' + LazyStorage.getNumber(BEST_KEY, 0);
  }

  function mount() {
    initDom();
    bind();
    reset();
    refreshLobbyStats();
  }

  function unmount() {
    clearInterval(timer);
    running = false;
  }

  global.SnakeGame = { mount, unmount, refreshLobbyStats, BEST_KEY };
})(typeof window !== 'undefined' ? window : globalThis);
/* Lazy Lagoon - Breakout */
(function (global) {
  const BEST_KEY = 'breakout.best';
  const W = 480;
  const H = 360;
  const PADDLE_W = 80;
  const PADDLE_H = 12;
  const BALL_R = 6;
  const ROWS = 4;
  const COLS = 10;
  const BRICK_PAD = 4;
  const BRICK_TOP = 48;
  const LIVES0 = 3;

  let canvas, ctx;
  let paddleX, ballX, ballY, vx, vy;
  let bricks = [];
  let score = 0;
  let lives = LIVES0;
  let best = 0;
  let running = false;
  let paused = false;
  let over = false;
  let won = false;
  let raf = 0;
  let bound = false;
  let keys = { left: false, right: false };
  let reducedMotion = false;

  const COLORS = ['#39ff14', '#7ec8ff', '#ff9f1c', '#ff5ec8'];

  function initDom() {
    canvas = document.getElementById('breakout-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    try {
      reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { /* */ }
    resize();
  }

  function resize() {
    if (!canvas) return;
    const css = Math.min(W, canvas.parentElement ? canvas.parentElement.clientWidth : W);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = css + 'px';
    canvas.style.height = (css * H / W) + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function buildBricks() {
    bricks = [];
    const totalPad = BRICK_PAD * (COLS + 1);
    const bw = (W - totalPad) / COLS;
    const bh = 16;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        bricks.push({
          x: BRICK_PAD + c * (bw + BRICK_PAD),
          y: BRICK_TOP + r * (bh + BRICK_PAD),
          w: bw,
          h: bh,
          alive: true,
          color: COLORS[r % COLORS.length],
        });
      }
    }
  }

  function resetBall() {
    ballX = W / 2;
    ballY = H - 60;
    const angle = (-Math.PI / 3) + Math.random() * (Math.PI / 3);
    const speed = 3.6;
    vx = Math.cos(angle) * speed;
    vy = -Math.abs(Math.sin(angle) * speed);
  }

  function updateHud() {
    const s = document.getElementById('breakout-score');
    const l = document.getElementById('breakout-lives');
    const b = document.getElementById('breakout-best');
    if (s) s.textContent = String(score);
    if (l) l.textContent = String(lives);
    if (b) b.textContent = String(best);
    const pauseBtn = document.getElementById('breakout-pause');
    if (pauseBtn) pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  }

  function hideOverlay() {
    document.getElementById('breakout-overlay')?.classList.remove('visible');
  }

  function showOverlay(title, msg, canSubmit, isPause) {
    const ov = document.getElementById('breakout-overlay');
    if (!ov) return;
    ov.querySelector('h3').textContent = title;
    ov.querySelector('p').textContent = msg;
    const resume = document.getElementById('breakout-resume');
    if (resume) resume.style.display = isPause ? '' : 'none';
    const again = document.getElementById('breakout-again');
    if (again) again.style.display = isPause ? 'none' : '';
    const exitBtn = document.getElementById('breakout-exit');
    if (exitBtn) exitBtn.style.display = isPause ? 'none' : '';
    if (global.LazyLeaderboard) {
      LazyLeaderboard.fillScoreForm(ov, {
        show: !!canSubmit && !isPause,
        getPayload: () => ({
          game: 'breakout',
          score: score,
          unit: 'pts',
          metric: 'score',
        }),
      });
    }
    ov.classList.add('visible');
  }

  function remaining() {
    return bricks.filter((b) => b.alive).length;
  }

  function endWin() {
    over = true;
    won = true;
    running = false;
    best = LazyStorage.updateBestHigh(BEST_KEY, score);
    updateHud();
    refreshLobbyStats();
    showOverlay('Cleared!', 'Score: ' + score + (score >= best ? ' · New best!' : ''), true, false);
  }

  function endLose() {
    over = true;
    won = false;
    running = false;
    best = LazyStorage.updateBestHigh(BEST_KEY, score);
    updateHud();
    refreshLobbyStats();
    showOverlay('Game Over', 'Score: ' + score + (score >= best ? ' · New best!' : ''), true, false);
  }

  function draw() {
    if (!ctx) return;
    ctx.fillStyle = '#020c10';
    ctx.fillRect(0, 0, W, H);

    // bricks
    bricks.forEach((b) => {
      if (!b.alive) return;
      ctx.fillStyle = b.color;
      if (!reducedMotion) {
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 8;
      }
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.shadowBlur = 0;
    });

    // paddle
    ctx.fillStyle = '#b8ff9a';
    if (!reducedMotion) {
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = 10;
    }
    ctx.fillRect(paddleX, H - 28, PADDLE_W, PADDLE_H);
    ctx.shadowBlur = 0;

    // ball
    ctx.beginPath();
    ctx.fillStyle = '#7ec8ff';
    if (!reducedMotion) {
      ctx.shadowColor = '#7ec8ff';
      ctx.shadowBlur = 12;
    }
    ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (!running && !over && !paused) {
      ctx.fillStyle = 'rgba(184,255,154,0.85)';
      ctx.font = '16px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Click / Space / Arrow to launch', W / 2, H / 2);
    }
  }

  function step() {
    if (!running || paused || over) {
      draw();
      return;
    }

    const speed = 6;
    if (keys.left) paddleX -= speed;
    if (keys.right) paddleX += speed;
    paddleX = Math.max(0, Math.min(W - PADDLE_W, paddleX));

    ballX += vx;
    ballY += vy;

    if (ballX < BALL_R) { ballX = BALL_R; vx = Math.abs(vx); }
    if (ballX > W - BALL_R) { ballX = W - BALL_R; vx = -Math.abs(vx); }
    if (ballY < BALL_R) { ballY = BALL_R; vy = Math.abs(vy); }

    // paddle
    const py = H - 28;
    if (
      ballY + BALL_R >= py &&
      ballY + BALL_R <= py + PADDLE_H + 4 &&
      ballX >= paddleX &&
      ballX <= paddleX + PADDLE_W &&
      vy > 0
    ) {
      ballY = py - BALL_R;
      const hit = (ballX - (paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
      const angle = hit * (Math.PI / 3);
      const spd = Math.min(7.5, Math.hypot(vx, vy) * 1.02 + 0.05);
      vx = Math.sin(angle) * spd;
      vy = -Math.abs(Math.cos(angle) * spd);
    }

    // bricks
    for (let i = 0; i < bricks.length; i++) {
      const b = bricks[i];
      if (!b.alive) continue;
      if (
        ballX + BALL_R > b.x &&
        ballX - BALL_R < b.x + b.w &&
        ballY + BALL_R > b.y &&
        ballY - BALL_R < b.y + b.h
      ) {
        b.alive = false;
        score += 10;
        best = LazyStorage.updateBestHigh(BEST_KEY, score);
        updateHud();
        // bounce from nearest edge
        const overlapL = ballX + BALL_R - b.x;
        const overlapR = b.x + b.w - (ballX - BALL_R);
        const overlapT = ballY + BALL_R - b.y;
        const overlapB = b.y + b.h - (ballY - BALL_R);
        const minX = Math.min(overlapL, overlapR);
        const minY = Math.min(overlapT, overlapB);
        if (minX < minY) vx = -vx;
        else vy = -vy;
        if (remaining() === 0) {
          endWin();
          draw();
          return;
        }
        break;
      }
    }

    if (ballY - BALL_R > H) {
      lives -= 1;
      updateHud();
      if (lives <= 0) {
        endLose();
        draw();
        return;
      }
      running = false;
      resetBall();
      paddleX = (W - PADDLE_W) / 2;
    }

    draw();
  }

  function loop() {
    step();
    raf = requestAnimationFrame(loop);
  }

  function launch() {
    if (over) return;
    if (!running) {
      running = true;
      paused = false;
      hideOverlay();
    }
  }

  function togglePause() {
    if (over || (!running && !paused)) return;
    paused = !paused;
    if (paused) {
      showOverlay('Paused', 'Resume when ready.', false, true);
    } else {
      hideOverlay();
      running = true;
    }
    updateHud();
  }

  function reset() {
    cancelAnimationFrame(raf);
    score = 0;
    lives = LIVES0;
    over = false;
    won = false;
    running = false;
    paused = false;
    paddleX = (W - PADDLE_W) / 2;
    best = LazyStorage.getNumber(BEST_KEY, 0);
    buildBricks();
    resetBall();
    if (global.LazyLeaderboard) LazyLeaderboard.resetRound();
    hideOverlay();
    updateHud();
    draw();
    raf = requestAnimationFrame(loop);
  }

  function pointerToPaddle(clientX) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    paddleX = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W / 2));
    if (!running && !over) launch();
  }

  function onKey(e) {
    const view = document.getElementById('view-breakout');
    if (!view || !view.classList.contains('active')) return;
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'a', 'd', ' ', 'arrowup', 'w'].includes(k) || e.code === 'Space') {
      e.preventDefault();
    }
    if (k === 'arrowleft' || k === 'a') {
      keys.left = e.type === 'keydown';
      if (e.type === 'keydown') launch();
    } else if (k === 'arrowright' || k === 'd') {
      keys.right = e.type === 'keydown';
      if (e.type === 'keydown') launch();
    } else if (k === ' ' || e.code === 'Space' || k === 'arrowup' || k === 'w') {
      if (e.type === 'keydown') {
        if (over) reset();
        else if (paused) togglePause();
        else if (!running) launch();
        else togglePause();
      }
    }
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);
    document.getElementById('breakout-restart')?.addEventListener('click', reset);
    document.getElementById('breakout-pause')?.addEventListener('click', () => {
      if (!running && !paused && !over) return;
      togglePause();
    });
    document.getElementById('breakout-resume')?.addEventListener('click', () => {
      if (paused) togglePause();
    });
    document.getElementById('breakout-again')?.addEventListener('click', reset);
    document.getElementById('breakout-exit')?.addEventListener('click', () => {
      hideOverlay();
      if (global.LazyLagoon) LazyLagoon.navigate('/');
    });

    if (canvas) {
      canvas.addEventListener('mousemove', (e) => pointerToPaddle(e.clientX));
      canvas.addEventListener('mousedown', (e) => {
        pointerToPaddle(e.clientX);
        launch();
      });
      canvas.addEventListener('touchmove', (e) => {
        if (e.touches[0]) {
          e.preventDefault();
          pointerToPaddle(e.touches[0].clientX);
        }
      }, { passive: false });
      canvas.addEventListener('touchstart', (e) => {
        if (e.touches[0]) {
          e.preventDefault();
          pointerToPaddle(e.touches[0].clientX);
          launch();
        }
      }, { passive: false });
    }
    window.addEventListener('resize', () => { resize(); draw(); });
  }

  function refreshLobbyStats() {
    const el = document.querySelector('[data-stat="breakout"]');
    if (el) el.textContent = 'Best: ' + LazyStorage.getNumber(BEST_KEY, 0);
  }

  function mount() {
    initDom();
    bind();
    reset();
    refreshLobbyStats();
  }

  function unmount() {
    cancelAnimationFrame(raf);
    running = false;
    keys.left = false;
    keys.right = false;
  }

  global.BreakoutGame = { mount, unmount, refreshLobbyStats, BEST_KEY };
})(typeof window !== 'undefined' ? window : globalThis);

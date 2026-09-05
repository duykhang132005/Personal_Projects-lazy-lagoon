/* Lazy Lagoon - interactive 8-bit lake background */
(function () {
  const PIXEL = 8;
  const canvas = document.getElementById('lake-bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const reduced =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let w = 0;
  let h = 0;
  let cols = 0;
  let rows = 0;
  let mouseX = 0.5;
  let mouseY = 0.5;
  let targetMX = 0.5;
  let targetMY = 0.5;
  let t = 0;
  let raf = 0;
  let lastTs = 0;

  const pads = [];
  const ripples = [];
  const reeds = [];

  const C = {
    deep: '#041018',
    water1: '#0a2a38',
    water2: '#0d3548',
    water3: '#0f4058',
    shore: '#1a4a3a',
    shoreHi: '#2a6a4a',
    pad: '#1f9a3a',
    padDark: '#146028',
    neon: '#39ff14',
    neonDim: '#1f9a3a',
    reed: '#1a6a30',
    sky: '#031016',
  };

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / PIXEL) + 4;
    rows = Math.ceil(h / PIXEL) + 4;
    seedDecor();
  }

  function seedDecor() {
    pads.length = 0;
    reeds.length = 0;
    const padCount = Math.max(6, Math.floor((w * h) / 90000));
    for (let i = 0; i < padCount; i++) {
      pads.push({
        x: Math.random() * cols,
        y: rows * (0.35 + Math.random() * 0.55),
        size: 2 + Math.floor(Math.random() * 3),
        phase: Math.random() * Math.PI * 2,
        speed: 0.15 + Math.random() * 0.35,
        neon: Math.random() > 0.65,
      });
    }
    const reedCount = Math.max(8, Math.floor(w / 80));
    for (let i = 0; i < reedCount; i++) {
      reeds.push({
        x: Math.floor(Math.random() * cols),
        baseY: Math.floor(rows * (0.28 + Math.random() * 0.12)),
        h: 3 + Math.floor(Math.random() * 5),
        tip: Math.random() > 0.4,
      });
    }
  }

  function px(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x) * PIXEL, Math.floor(y) * PIXEL, PIXEL, PIXEL);
  }

  function fillRectPx(x, y, ww, hh, color) {
    ctx.fillStyle = color;
    ctx.fillRect(
      Math.floor(x) * PIXEL,
      Math.floor(y) * PIXEL,
      Math.floor(ww) * PIXEL,
      Math.floor(hh) * PIXEL
    );
  }

  function drawWater(parallaxX, parallaxY) {
    const shoreRow = Math.floor(rows * 0.3 + parallaxY * 2);
    // sky / deep above shore
    ctx.fillStyle = C.sky;
    ctx.fillRect(0, 0, w, shoreRow * PIXEL);
    // water body
    for (let y = shoreRow; y < rows; y++) {
      const wave =
        Math.sin(y * 0.35 + t * 0.8 + parallaxX) * 0.5 +
        Math.sin(y * 0.15 - t * 0.4) * 0.3;
      const band = ((y + Math.floor(t * 0.5 + wave)) % 4);
      let color = C.water1;
      if (band === 1) color = C.water2;
      else if (band === 2) color = C.water3;
      else if (band === 3) color = C.water1;
      fillRectPx(0, y, cols, 1, color);
    }
    // horizontal neon shimmer lines
    if (!reduced) {
      for (let i = 0; i < 5; i++) {
        const yy =
          shoreRow +
          4 +
          ((Math.floor(t * 1.2 + i * 7 + parallaxX * 3) + i * 11) %
            Math.max(1, rows - shoreRow - 2));
        const xx = (Math.floor(t * 2 + i * 13 + parallaxX * 8) % cols) - 2;
        fillRectPx(xx, yy, 4 + (i % 3), 1, i % 2 ? C.neonDim : 'rgba(57,255,20,0.35)');
      }
    }
    // shore
    fillRectPx(0, shoreRow, cols, 2, C.shore);
    fillRectPx(2 + Math.floor(parallaxX), shoreRow - 1, 6, 1, C.shoreHi);
    fillRectPx(cols - 14 + Math.floor(parallaxX * 0.5), shoreRow - 1, 8, 1, C.shoreHi);
  }

  function drawReeds(parallaxX, parallaxY) {
    const ox = parallaxX * 1.5;
    const oy = parallaxY * 0.8;
    reeds.forEach((r) => {
      const x = r.x + ox;
      const sway = reduced ? 0 : Math.sin(t * 1.5 + r.x) * 0.4;
      for (let i = 0; i < r.h; i++) {
        px(x + sway * (i / r.h), r.baseY - i + oy, i === r.h - 1 && r.tip ? C.neon : C.reed);
      }
    });
  }

  function drawPad(p, parallaxX, parallaxY) {
    const drift = reduced ? 0 : Math.sin(t * p.speed + p.phase);
    const x = p.x + drift * 1.5 + parallaxX * 2.2;
    const y = p.y + Math.cos(t * p.speed * 0.7 + p.phase) * 0.6 + parallaxY * 1.5;
    const s = p.size;
    // pad body
    fillRectPx(x, y, s + 1, s, C.pad);
    fillRectPx(x - 0.5, y + 0.5, 1, s - 1, C.pad);
    fillRectPx(x + s + 0.5, y + 0.5, 1, s - 1, C.pad);
    // notch
    fillRectPx(x + s * 0.4, y - 0.2, 1, Math.max(1, s * 0.45), C.water2);
    // dark underside
    fillRectPx(x + 0.5, y + s - 0.5, s, 1, C.padDark);
    if (p.neon) {
      fillRectPx(x + 0.5, y, s, 1, C.neon);
      px(x + s * 0.4, y + s * 0.4, C.neon);
    }
  }

  function drawRipples() {
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.life += 0.035;
      if (r.life >= 1) {
        ripples.splice(i, 1);
        continue;
      }
      const radius = r.life * r.max;
      const alpha = 1 - r.life;
      ctx.strokeStyle = 'rgba(57,255,20,' + (alpha * 0.7).toFixed(3) + ')';
      ctx.lineWidth = PIXEL;
      ctx.beginPath();
      // chunky ring approximated with rects
      const steps = 16;
      for (let s = 0; s < steps; s++) {
        const a = (s / steps) * Math.PI * 2;
        const pxX = r.x + Math.cos(a) * radius;
        const pxY = r.y + Math.sin(a) * radius;
        px(pxX, pxY, 'rgba(57,255,20,' + (alpha * 0.65).toFixed(3) + ')');
      }
    }
  }

  function addRipple(clientX, clientY, maxR) {
    if (reduced) return;
    ripples.push({
      x: clientX / PIXEL,
      y: clientY / PIXEL,
      life: 0,
      max: maxR || 4 + Math.random() * 3,
    });
  }

  function frame(ts) {
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
    lastTs = ts;
    if (!reduced) t += dt;

    mouseX += (targetMX - mouseX) * (reduced ? 1 : 0.06);
    mouseY += (targetMY - mouseY) * (reduced ? 1 : 0.06);

    const parallaxX = (mouseX - 0.5) * 3;
    const parallaxY = (mouseY - 0.5) * 2;

    ctx.clearRect(0, 0, w, h);
    // vignette base
    ctx.fillStyle = C.deep;
    ctx.fillRect(0, 0, w, h);

    drawWater(parallaxX, parallaxY);
    drawReeds(parallaxX * 0.6, parallaxY * 0.4);
    pads.forEach((p) => drawPad(p, parallaxX, parallaxY));

    // soft cursor ripple trail
    if (!reduced && (Math.abs(targetMX - mouseX) > 0.002 || Math.abs(targetMY - mouseY) > 0.002)) {
      if (Math.random() < 0.08) {
        addRipple(mouseX * w, mouseY * h, 2.5);
      }
    }
    drawRipples();

    // top vignette so UI stays readable
    const grad = ctx.createLinearGradient(0, 0, 0, h * 0.35);
    grad.addColorStop(0, 'rgba(4,16,24,0.55)');
    grad.addColorStop(1, 'rgba(4,16,24,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h * 0.35);

    raf = requestAnimationFrame(frame);
  }

  function onMove(e) {
    targetMX = e.clientX / Math.max(1, w);
    targetMY = e.clientY / Math.max(1, h);
  }

  function onClick(e) {
    // ignore clicks on interactive UI so we don't steal focus feel —
    // splash is decorative only; canvas has pointer-events:none
    const tag = (e.target && e.target.tagName) || '';
    if (/BUTTON|INPUT|A|CANVAS|TD|SELECT|TEXTAREA/.test(tag)) {
      // still splash near click for fun when not on game canvas? optional
      if (tag === 'CANVAS' && e.target.id !== 'lake-bg') return;
    }
    addRipple(e.clientX, e.clientY, 5 + Math.random() * 3);
  }

  function start() {
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('click', onClick, { passive: true });
    if (reduced) {
      // one static paint
      lastTs = performance.now();
      frame(lastTs);
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(frame);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
/* Lazy Lagoon - loading overlay with neon progress + chunked async */
(function (global) {
  let overlay, bar, label, titleEl;
  let reducedMotion = false;

  function init() {
    overlay = document.getElementById('loader-overlay');
    bar = document.getElementById('loader-bar');
    label = document.getElementById('loader-stage');
    titleEl = document.getElementById('loader-title');
    try {
      reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      reducedMotion = false;
    }
  }

  function show(title) {
    if (!overlay) init();
    if (titleEl) titleEl.textContent = title || 'Loading...';
    if (bar) bar.style.width = '0%';
    if (label) label.textContent = '';
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function hide() {
    if (!overlay) init();
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function setProgress(pct, stage) {
    if (!overlay) init();
    const p = Math.max(0, Math.min(100, pct));
    if (bar) bar.style.width = p + '%';
    if (label && stage != null) label.textContent = stage;
  }

  /** Yield to browser so progress UI can paint */
  function yieldFrame() {
    return new Promise((resolve) => {
      if (reducedMotion) {
        setTimeout(resolve, 0);
      } else {
        requestAnimationFrame(() => resolve());
      }
    });
  }

  /**
   * Run async work that reports { progress, stage }.
   * work(report) where report(pct, stage) updates UI.
   */
  async function run(title, work) {
    show(title);
    await yieldFrame();
    try {
      const report = async (pct, stage) => {
        setProgress(pct, stage);
        await yieldFrame();
      };
      const result = await work(report);
      setProgress(100, 'Done');
      await yieldFrame();
      return result;
    } finally {
      hide();
    }
  }

  /**
   * Process an array (or count) in chunks with progress.
   */
  async function chunked(items, chunkSize, onChunk, report, basePct, spanPct, stage) {
    const list = typeof items === 'number' ? Array.from({ length: items }, (_, i) => i) : items;
    const n = list.length;
    if (n === 0) return;
    for (let i = 0; i < n; i += chunkSize) {
      const end = Math.min(i + chunkSize, n);
      for (let j = i; j < end; j++) {
        await onChunk(list[j], j);
      }
      const t = end / n;
      if (report) await report(basePct + spanPct * t, stage);
      else await yieldFrame();
    }
  }

  global.LazyLoader = {
    init,
    show,
    hide,
    setProgress,
    yieldFrame,
    run,
    chunked,
  };
})(typeof window !== 'undefined' ? window : globalThis);

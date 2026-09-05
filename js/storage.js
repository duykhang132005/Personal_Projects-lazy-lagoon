/* Lazy Lagoon - namespaced localStorage helpers */
(function (global) {
  const PREFIX = 'lazyLagoon.';

  function key(name) {
    return PREFIX + name;
  }

  function get(name, fallback = null) {
    try {
      const raw = localStorage.getItem(key(name));
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function set(name, value) {
    try {
      localStorage.setItem(key(name), JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function getNumber(name, fallback = 0) {
    const v = get(name, fallback);
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  /** Keep highest score */
  function updateBestHigh(name, score) {
    const prev = getNumber(name, 0);
    if (score > prev) {
      set(name, score);
      return score;
    }
    return prev;
  }

  /** Keep lowest positive time (ms or seconds - caller consistent) */
  function updateBestLow(name, value) {
    const prev = get(name, null);
    if (prev == null || value < Number(prev)) {
      set(name, value);
      return value;
    }
    return Number(prev);
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ':' + String(r).padStart(2, '0');
  }

  global.LazyStorage = {
    PREFIX,
    key,
    get,
    set,
    getNumber,
    updateBestHigh,
    updateBestLow,
    formatTime,
  };
})(typeof window !== 'undefined' ? window : globalThis);

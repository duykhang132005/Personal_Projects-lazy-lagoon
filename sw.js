/*
 * Lazy Lagoon - service worker for installable, offline play.
 *
 * Network first, cache fallback, for Lazy Lagoon's own files only. It only answers same-origin
 * GET requests inside its own registration scope whose path is in PRECACHE below; everything
 * else (other projects on the same host, unknown files) goes straight to the network untouched.
 *
 * Bump CACHE_VERSION whenever you ship changes so old caches get cleaned up.
 */
const CACHE_PREFIX = 'lazy-lagoon-';
const CACHE_VERSION = 'v5';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

// Paths relative to the registration scope. js/leaderboard-config.js is intentionally not here.
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/storage.js',
  'js/leaderboard.js',
  'js/loader.js',
  'js/snake.js',
  'js/minesweeper.js',
  'js/tictactoe.js',
  'js/sudoku.js',
  'js/memory.js',
  'js/twenty48.js',
  'js/breakout.js',
  'js/lake-bg.js',
  'js/main.js',
  'data/leaderboard-seed.json',
  'assets/lazy-lagoon-logo.svg',
  'assets/icon-192.png',
  'assets/icon-512.png',
];

const SCOPE = self.registration.scope;
// Absolute URLs without query or hash.
const KNOWN = new Set(PRECACHE.map((p) => new URL(p, SCOPE).href));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE.map((p) => new Request(new URL(p, SCOPE).href, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function cacheKey(url) {
  // Ignore query and hash for our own known paths (the seed is fetched with ?t=...).
  return url.origin + url.pathname;
}

async function networkFirst(request, key) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic' && !response.redirected) {
      cache.put(key, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    const cached = await cache.match(key);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.href.startsWith(SCOPE)) return;
  const key = cacheKey(url);
  if (!KNOWN.has(key)) return;
  event.respondWith(networkFirst(request, key));
});

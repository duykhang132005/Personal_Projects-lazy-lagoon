#!/usr/bin/env node
/*
 * Lazy Lagoon dev-only smoke test (not part of the shipped site).
 *
 * First runs a fast static pre-check (service worker PRECACHE coverage + asset
 * paths in index.html / the manifest / og tags). Then serves the project folder
 * over http on a random local port, loads every route in headless Chrome, opens
 * the leaderboard, and checks the dialog and table render. Exits non-zero on any
 * static failure, page error, console error, failed request, or failed check.
 *
 * Setup (nothing is saved to the repo, tools/node_modules is gitignored):
 *   npm i --no-save --prefix tools puppeteer-core
 * Run from the project root:
 *   node tools/smoke-test.js
 * Static checks only (no Chrome / puppeteer-core needed):
 *   node tools/smoke-test.js --static-only
 * Chrome path: defaults to the standard install for Windows, macOS, or Linux. Override with CHROME_PATH.
 * On Linux or CI, Chrome runs with --no-sandbox (needed on GitHub Actions runners).
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STATIC_ONLY = process.argv.includes('--static-only');
const PAGES_BASE = 'https://duykhang132005.github.io/Personal_Projects-lazy-lagoon/';
const IS_LINUX = process.platform === 'linux';
const IS_CI = !!process.env.CI;

function defaultChrome() {
  if (process.platform === 'win32') return 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  if (process.platform === 'darwin') return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

const CHROME = process.env.CHROME_PATH || defaultChrome();
const ROUTES = ['#/', '#/snake', '#/minesweeper', '#/tictactoe', '#/sudoku', '#/memory', '#/2048', '#/breakout'];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const isFavicon = (s) => /favicon/i.test(s || '');

/** Normalize a PRECACHE / site path relative to the project root. */
function norm(p) {
  let s = String(p || '').trim().replace(/\\/g, '/');
  if (!s || s === './' || s === '/') return '';
  s = s.replace(/^\.\//, '').replace(/^\/+/, '');
  return s;
}

function listFiles(dir, ext) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((n) => n.endsWith(ext) && fs.statSync(path.join(abs, n)).isFile())
    .map((n) => dir + '/' + n)
    .sort();
}

function parsePrecache(swText) {
  const m = swText.match(/\b(?:const|let|var)\s+PRECACHE\s*=\s*\[([\s\S]*?)\];/);
  if (!m) throw new Error('Could not find PRECACHE = [ ... ]; in sw.js');
  const items = [];
  const re = /(['"])(.*?)\1/g;
  let hit;
  while ((hit = re.exec(m[1]))) items.push(hit[2]);
  if (!items.length) throw new Error('PRECACHE array in sw.js is empty');
  return items;
}

function attrMatches(html, tag, attr) {
  const out = [];
  const re = new RegExp('<' + tag + '\\b[^>]*>', 'gi');
  let m;
  while ((m = re.exec(html))) {
    const tagHtml = m[0];
    const am = tagHtml.match(new RegExp('\\b' + attr + '\\s*=\\s*(["\'])(.*?)\\1', 'i'));
    if (am) out.push({ value: am[2], tag: tagHtml });
  }
  return out;
}

function metaContent(html, attr, name) {
  const re = new RegExp(
    '<meta\\b[^>]*\\b' + attr + '\\s*=\\s*(["\'])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\1[^>]*>',
    'i'
  );
  const m = html.match(re);
  if (!m) return null;
  const cm = m[0].match(/\bcontent\s*=\s*(["'])(.*?)\1/i);
  return cm ? cm[2] : null;
}

function pagesLocalPath(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.startsWith(PAGES_BASE)) return null;
  return norm(url.slice(PAGES_BASE.length));
}

/**
 * Fast static guards that run before Chrome.
 *
 * Precache: every shipped site file must appear in sw.js PRECACHE (and every
 * PRECACHE entry must exist on disk). Shipped = index.html, manifest.webmanifest,
 * data/leaderboard-seed.json, every css/*.css, every js/*.js except
 * js/leaderboard-config.js, and every asset referenced by index.html / the
 * manifest (icons, logo). assets/og-image.png is for link previews only and is
 * intentionally optional in PRECACHE (it is still checked via og:image /
 * twitter:image below). js/leaderboard-config.js must never be in PRECACHE.
 */
function runStaticChecks() {
  const problems = [];
  const swPath = path.join(ROOT, 'sw.js');
  const indexPath = path.join(ROOT, 'index.html');
  const manifestPath = path.join(ROOT, 'manifest.webmanifest');

  if (!fs.existsSync(swPath)) problems.push('sw.js is missing');
  if (!fs.existsSync(indexPath)) problems.push('index.html is missing');
  if (!fs.existsSync(manifestPath)) problems.push('manifest.webmanifest is missing');
  if (problems.length) return problems;

  let precacheRaw;
  try {
    precacheRaw = parsePrecache(fs.readFileSync(swPath, 'utf8'));
  } catch (e) {
    return ['sw.js: ' + e.message];
  }
  const precache = precacheRaw.map(norm);
  const precacheSet = new Set(precache.filter(Boolean));

  // Presence of every listed path (skip the empty './' entry, which maps to /).
  precacheRaw.forEach((raw, i) => {
    const n = precache[i];
    if (!n) return;
    if (n === 'js/leaderboard-config.js') {
      problems.push('PRECACHE must not list js/leaderboard-config.js (parked / not shipped)');
      return;
    }
    if (!fs.existsSync(path.join(ROOT, n))) {
      problems.push('PRECACHE lists missing file: ' + raw);
    }
  });

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    problems.push('manifest.webmanifest is not valid JSON: ' + e.message);
    manifest = null;
  }

  const html = fs.readFileSync(indexPath, 'utf8');
  const required = new Set([
    'index.html',
    'manifest.webmanifest',
    'data/leaderboard-seed.json',
    ...listFiles('css', '.css'),
    ...listFiles('js', '.js').filter((p) => p !== 'js/leaderboard-config.js'),
  ]);

  // Assets referenced by the HTML head (icons, manifest, stylesheets, scripts, imgs).
  const localRefs = [];
  attrMatches(html, 'link', 'href').forEach(({ value, tag }) => {
    if (/^\s*#/.test(value) || /^(https?:|data:|mailto:)/i.test(value)) return;
    if (/\brel\s*=\s*(["'])(?:icon|apple-touch-icon|manifest|stylesheet)\1/i.test(tag) || /stylesheet|icon|manifest/i.test(tag)) {
      localRefs.push(norm(value.split('?')[0]));
    }
  });
  attrMatches(html, 'script', 'src').forEach(({ value }) => {
    if (!value || /^(https?:|data:)/i.test(value)) return;
    localRefs.push(norm(value.split('?')[0]));
  });
  attrMatches(html, 'img', 'src').forEach(({ value }) => {
    if (!value || /^(https?:|data:)/i.test(value)) return;
    localRefs.push(norm(value.split('?')[0]));
  });

  if (manifest && Array.isArray(manifest.icons)) {
    manifest.icons.forEach((icon, i) => {
      if (!icon || !icon.src) {
        problems.push('manifest.icons[' + i + '] is missing src');
        return;
      }
      const n = norm(icon.src);
      if (!n) {
        problems.push('manifest.icons[' + i + '].src is empty');
        return;
      }
      required.add(n);
      if (!fs.existsSync(path.join(ROOT, n))) {
        problems.push('manifest icon missing on disk: ' + icon.src);
      }
    });
  }

  localRefs.forEach((n) => {
    if (!n) return;
    required.add(n);
    if (!fs.existsSync(path.join(ROOT, n))) {
      problems.push('index.html references missing file: ' + n);
    }
  });

  // og / twitter absolute URLs on the Pages base must map to real local files.
  const ogUrl = metaContent(html, 'property', 'og:url');
  if (!ogUrl) problems.push('index.html is missing og:url');
  else if (ogUrl !== PAGES_BASE && ogUrl !== PAGES_BASE.replace(/\/$/, '')) {
    problems.push('og:url must be ' + PAGES_BASE + ' (got ' + ogUrl + ')');
  }

  ['og:image', 'twitter:image'].forEach((name) => {
    const attr = name.startsWith('og:') ? 'property' : 'name';
    const val = metaContent(html, attr, name);
    if (!val) {
      problems.push('index.html is missing ' + name);
      return;
    }
    const local = pagesLocalPath(val);
    if (!local) {
      problems.push(name + ' must be an absolute URL under ' + PAGES_BASE + ' (got ' + val + ')');
      return;
    }
    if (!fs.existsSync(path.join(ROOT, local))) {
      problems.push(name + ' maps to missing file: ' + local);
    }
  });

  // Install essentials must always be precached, even if the HTML or manifest stops referencing them.
  ['manifest.webmanifest', 'assets/icon-192.png', 'assets/icon-512.png'].forEach((n) => required.add(n));

  // Precache must cover every required shipped file. og-image is optional.
  const optionalInPrecache = new Set(['assets/og-image.png']);
  [...required].sort().forEach((n) => {
    if (optionalInPrecache.has(n)) return;
    if (!precacheSet.has(n)) {
      problems.push('PRECACHE is missing shipped file: ' + n);
    }
  });

  return problems;
}

function printStaticSummary(problems) {
  if (problems.length) {
    console.error('Static checks failed (' + problems.length + '):');
    problems.forEach((p) => console.error('  - ' + p));
    return false;
  }
  console.log('Static checks OK (PRECACHE coverage + index/manifest/og asset paths).');
  return true;
}

function startServer() {
  const server = http.createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    const file = path.normalize(path.join(ROOT, urlPath));
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function checkRoute(browser, base, route) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push('pageerror: ' + (err && err.message ? err.message : String(err))));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const loc = (msg.location() && msg.location().url) || '';
    if (isFavicon(msg.text()) || isFavicon(loc)) return;
    errors.push('console.error: ' + msg.text() + (loc ? ' (' + loc + ')' : ''));
  });
  page.on('requestfailed', (req) => {
    if (!isFavicon(req.url())) errors.push('request failed: ' + req.url());
  });
  page.on('response', (res) => {
    if (res.status() >= 400 && !isFavicon(res.url())) errors.push('HTTP ' + res.status() + ': ' + res.url());
  });

  try {
    await page.goto(base + route, { waitUntil: 'load', timeout: 20000 });
    const view = route === '#/' ? 'lobby' : route.slice(2);
    await page.waitForSelector('#view-' + view + '.active', { timeout: 10000 });

    await page.click('#btn-leaderboard');
    await page.waitForFunction(() => {
      const ov = document.getElementById('lb-overlay');
      return !!ov && ov.classList.contains('visible') && ov.getAttribute('aria-hidden') === 'false';
    }, { timeout: 5000 });
    await page.waitForSelector('#lb-modal-body .lb-table-wrap', { timeout: 5000 });
    const rows = await page.$$eval('#lb-modal-body table.lb-table tbody tr', (trs) => trs.length);
    if (rows < 1) errors.push('leaderboard table rendered no rows (seed scores missing?)');

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('lb-overlay').classList.contains('visible'), {
      timeout: 5000,
    });
    await sleep(300); // let any late errors surface
  } catch (e) {
    errors.push('check failed: ' + e.message);
  } finally {
    await page.close();
  }
  return errors;
}

async function main() {
  if (!printStaticSummary(runStaticChecks())) process.exit(1);
  if (STATIC_ONLY) {
    console.log('Static-only mode: skipping Chrome routes.');
    return;
  }

  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch {
    console.error('puppeteer-core is not installed. Run: npm i --no-save --prefix tools puppeteer-core');
    console.error('Or run static checks only: node tools/smoke-test.js --static-only');
    process.exit(2);
  }

  if (!fs.existsSync(CHROME)) {
    console.error('Chrome not found at ' + CHROME + '. Set CHROME_PATH.');
    process.exit(2);
  }
  const server = await startServer();
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const args = ['--no-first-run', '--no-default-browser-check'];
  if (IS_LINUX || IS_CI) args.push('--no-sandbox', '--disable-dev-shm-usage');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args,
  });
  console.log('Chrome: ' + CHROME);

  let failed = 0;
  try {
    for (const route of ROUTES) {
      const errors = await checkRoute(browser, base, route);
      if (errors.length) {
        failed++;
        console.log('FAIL ' + route);
        errors.forEach((e) => console.log('  - ' + e));
      } else {
        console.log('ok   ' + route);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failed) {
    console.log('\n' + failed + ' of ' + ROUTES.length + ' routes failed.');
    process.exit(1);
  }
  console.log('\nAll ' + ROUTES.length + ' routes passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

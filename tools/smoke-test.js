#!/usr/bin/env node
/*
 * Lazy Lagoon dev-only smoke test (not part of the shipped site).
 *
 * Serves the project folder over http on a random local port, loads every route
 * in headless Chrome, opens the leaderboard, and checks the dialog and table render.
 * Exits non-zero on any page error, console error, failed request, or failed check.
 *
 * Setup (nothing is saved to the repo, tools/node_modules is gitignored):
 *   npm i --no-save --prefix tools puppeteer-core
 * Run from the project root:
 *   node tools/smoke-test.js
 * Chrome path: defaults to the standard Windows install. Override with CHROME_PATH.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch {
  console.error('puppeteer-core is not installed. Run: npm i --no-save --prefix tools puppeteer-core');
  process.exit(2);
}

const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROUTES = ['#/', '#/snake', '#/minesweeper', '#/tictactoe', '#/sudoku', '#/memory', '#/2048', '#/breakout'];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const isFavicon = (s) => /favicon/i.test(s || '');

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
  if (!fs.existsSync(CHROME)) {
    console.error('Chrome not found at ' + CHROME + '. Set CHROME_PATH.');
    process.exit(2);
  }
  const server = await startServer();
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-first-run', '--no-default-browser-check'],
  });

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

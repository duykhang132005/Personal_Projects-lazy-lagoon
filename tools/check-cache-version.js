#!/usr/bin/env node
/*
 * Lazy Lagoon: CACHE_VERSION guard for the service worker.
 *
 * Fails (exit 1) when a shipped site file changed between a base ref and HEAD but
 * CACHE_VERSION in sw.js did not. The whole range is compared at once (GitDoc makes
 * many small auto-commits, so per-commit checks would be noise).
 *
 * Shipped = the same files the precache guard in tools/smoke-test.js requires:
 * index.html, manifest.webmanifest, data/leaderboard-seed.json, css/*.css,
 * js/*.js except js/leaderboard-config.js, plus anything listed in sw.js PRECACHE
 * (icons, logo) at base or HEAD. sw.js itself is not counted (browsers re-check it
 * byte for byte anyway). README, tools/, .github/, server/ and other files never
 * require a bump.
 *
 * Usage (Node built-ins only):
 *   node tools/check-cache-version.js <base-ref>
 *   BASE_REF=<base-ref> node tools/check-cache-version.js
 * An empty or all-zero base (first push), or a base that is not in the local
 * history (for example after a force-push), skips the check with a notice.
 */
'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function git(args, opts = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', opts.quiet ? 'ignore' : 'pipe'],
  });
}

function tryGit(args) {
  try {
    return git(args, { quiet: true });
  } catch {
    return null;
  }
}

function norm(p) {
  let s = String(p || '').trim().replace(/\\/g, '/');
  if (!s || s === './' || s === '/') return '';
  return s.replace(/^\.\//, '').replace(/^\/+/, '');
}

function precacheOf(swText) {
  if (!swText) return [];
  const m = swText.match(/\b(?:const|let|var)\s+PRECACHE\s*=\s*\[([\s\S]*?)\];/);
  if (!m) return [];
  const out = [];
  const re = /(['"])(.*?)\1/g;
  let hit;
  while ((hit = re.exec(m[1]))) {
    const n = norm(hit[2]);
    if (n) out.push(n);
  }
  return out;
}

function versionOf(swText) {
  if (!swText) return null;
  const m = swText.match(/\bCACHE_VERSION\s*=\s*(['"])(.*?)\1/);
  return m ? m[2] : null;
}

function nextVersion(v) {
  const m = String(v).match(/^(.*?)(\d+)$/);
  return m ? m[1] + (Number(m[2]) + 1) : v + '-2';
}

function isShipped(file, precache) {
  if (file === 'sw.js') return false;
  if (file === 'js/leaderboard-config.js') return false;
  if (file === 'index.html' || file === 'manifest.webmanifest' || file === 'data/leaderboard-seed.json') return true;
  if (/^css\/[^/]+\.css$/.test(file)) return true;
  if (/^js\/[^/]+\.js$/.test(file)) return true;
  return precache.has(file);
}

function main() {
  const base = String(process.argv[2] || process.env.BASE_REF || '').trim();
  if (!base || /^0+$/.test(base)) {
    console.log('cache-version: no base ref (first push or not provided), skipping.');
    return 0;
  }
  const baseSha = tryGit(['rev-parse', '--verify', '--quiet', base + '^{commit}']);
  if (!baseSha) {
    console.log('cache-version: base "' + base + '" is not in local history, skipping. (CI needs fetch-depth: 0.)');
    return 0;
  }
  const from = (tryGit(['merge-base', baseSha.trim(), 'HEAD']) || baseSha).trim();
  const changed = git(['diff', '--name-only', from + '..HEAD'])
    .split(/\r?\n/)
    .map(norm)
    .filter(Boolean);

  const swBase = tryGit(['show', from + ':sw.js']);
  const swHead = tryGit(['show', 'HEAD:sw.js']);
  const precache = new Set([...precacheOf(swBase), ...precacheOf(swHead)]);
  const shipped = changed.filter((f) => isShipped(f, precache));
  const vBase = versionOf(swBase);
  const vHead = versionOf(swHead);
  const range = from.slice(0, 7) + '..HEAD';

  if (!shipped.length) {
    console.log('cache-version: OK, no shipped files changed in ' + range + ' (' + changed.length + ' other file(s)).');
    return 0;
  }
  if (!swHead) {
    console.log('cache-version: sw.js not found at HEAD, nothing to check.');
    return 0;
  }
  if (!swBase) {
    console.log('cache-version: OK, sw.js is new in ' + range + '.');
    return 0;
  }
  if (vHead === null) {
    console.error('cache-version: FAIL, could not read CACHE_VERSION from sw.js at HEAD.');
    return 1;
  }
  if (vBase === vHead) {
    console.error('cache-version: FAIL, shipped files changed in ' + range + ' but CACHE_VERSION is still "' + vHead + '".');
    const nv = nextVersion(vHead);
    const pre = (swHead.match(/\bCACHE_PREFIX\s*=\s*(['"])(.*?)\1/) || [])[2] || '';
    console.error('Next step: bump CACHE_VERSION to ' + nv + ' in sw.js' + (pre ? ' (cache name ' + pre + nv + ')' : '') + ' so installed copies refresh. Changed:');
    shipped.forEach((f) => console.error('  - ' + f));
    return 1;
  }
  console.log(
    'cache-version: OK, CACHE_VERSION "' + vBase + '" -> "' + vHead + '" covers ' + shipped.length + ' shipped change(s) in ' + range + '.'
  );
  return 0;
}

try {
  process.exit(main());
} catch (e) {
  console.error('cache-version: error: ' + (e && e.message ? e.message : e));
  process.exit(1);
}

#!/usr/bin/env node
/*
 * Lazy Lagoon: one command for the pre-push checks (npm run check, or node tools/check.js).
 * Runs the static smoke checks, then the CACHE_VERSION guard against @{u} or origin/main.
 * The pre-push hook in .githooks calls this same file. Node built-ins only.
 */
'use strict';

const { execFileSync, spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function run(script, args) {
  const r = spawnSync(process.execPath, [path.join(ROOT, script), ...args], { cwd: ROOT, stdio: 'inherit' });
  return r.status === null ? 1 : r.status;
}

function rev(ref) {
  try {
    return execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

console.log('check: static checks');
if (run('tools/smoke-test.js', ['--static-only']) !== 0) {
  console.error('check: FAIL, static checks failed.');
  process.exit(1);
}

const base = rev('@{u}') || rev('origin/main');
if (!base) {
  console.log('check: no upstream or origin/main, skipping cache version check.');
  process.exit(0);
}
console.log('check: cache version check against ' + base);
if (run('tools/check-cache-version.js', [base]) !== 0) {
  console.error('check: FAIL, cache version check failed.');
  process.exit(1);
}
console.log('check: all OK');

#!/usr/bin/env node
/*
 * Run tests/*.test.js with node --test. Listing files here keeps Windows Node happy
 * (node --test tests/ is treated as a missing module on this platform).
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const dir = path.join(ROOT, 'tests');
if (!fs.existsSync(dir)) {
  console.error('run-tests: tests/ folder is missing.');
  process.exit(1);
}
const files = fs
  .readdirSync(dir)
  .filter((n) => n.endsWith('.test.js'))
  .sort()
  .map((n) => path.join('tests', n));
if (!files.length) {
  console.error('run-tests: no tests/*.test.js files found.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], { cwd: ROOT, stdio: 'inherit' });
process.exit(result.status === null ? 1 : result.status);

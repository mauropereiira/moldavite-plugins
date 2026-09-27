#!/usr/bin/env node
// Runs every plugin (or the ids given) in the sandbox harness, one process
// each, and fails when a plugin cannot load, registers commands it did not
// declare, or uses an API its manifest does not ask for.
//
//   node scripts/smoke.mjs [plugin-id ...]

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SANDBOX = join(dirname(fileURLToPath(import.meta.url)), 'lib', 'sandbox.mjs');
const DEADLINE_MS = 30_000;

export function smokeTest(pluginDir) {
  const run = spawnSync(
    process.execPath,
    ['--experimental-vm-modules', '--no-warnings', '--max-old-space-size=256', SANDBOX, pluginDir],
    { encoding: 'utf8', timeout: DEADLINE_MS, maxBuffer: 1024 * 1024 }
  );
  if (run.error?.code === 'ETIMEDOUT' || run.signal) {
    return {
      failures: ['did not finish within 30 seconds; look for a loop that never ends'],
      warnings: [],
      commands: [],
    };
  }
  const line = run.stdout.trim().split('\n').pop() ?? '';
  try {
    return JSON.parse(line);
  } catch {
    return {
      failures: [`the sandbox crashed: ${(run.stderr || run.stdout).trim().slice(0, 500)}`],
      warnings: [],
      commands: [],
    };
  }
}

function main() {
  const root = resolve('.');
  const ids = process.argv.slice(2);
  const targets = ids.length ? ids : readdirSync(join(root, 'plugins'));
  let failed = 0;
  for (const id of targets) {
    const result = smokeTest(join(root, 'plugins', id));
    if (result.failures.length) {
      failed += 1;
      console.error(`✗ ${id}`);
      for (const failure of result.failures) console.error(`    ${failure}`);
    } else {
      const count = result.commands.length;
      console.log(`✓ ${id} loaded and registered ${count} command${count === 1 ? '' : 's'}`);
    }
    for (const warning of result.warnings) console.log(`    note: ${warning}`);
  }
  if (failed) {
    console.error(`\n${failed} plugin${failed === 1 ? '' : 's'} failed the smoke test. See docs/testing.md.`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();

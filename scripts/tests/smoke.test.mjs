import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { smokeTest } from '../smoke.mjs';
import { makeRepo, manifest } from './helpers.mjs';

function run(code, overrides = {}) {
  const root = makeRepo([{ manifest: manifest(overrides), code }]);
  return smokeTest(join(root, 'plugins', 'hello-world'));
}

const failedWith = (result, text) => result.failures.some((failure) => failure.includes(text));

test('a well-behaved plugin passes and its commands run', () => {
  const result = run(undefined);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.commands, ['say-hello']);
});

test('using an API the manifest does not ask for fails, as it does in the app', () => {
  const code = `export default function register(api) {
  api.commands.add({ id: 'say-hello', label: 'Say hello', handler: async () => { await api.notes.list(); } });
}`;
  assert.ok(failedWith(run(code), 'api.notes.list without the "notes.read" permission'));
});

test('declared and registered commands must match', () => {
  const code = `export default function register(api) {
  api.commands.add({ id: 'surprise', label: 'Surprise', handler: () => {} });
}`;
  const result = run(code);
  assert.ok(failedWith(result, 'declares command "say-hello" but the plugin never registers it'));
  assert.ok(failedWith(result, 'registers command "surprise" that manifest.json does not declare'));
});

test('load failures are reported: syntax, imports, throwing, no default export, hanging', () => {
  assert.ok(failedWith(run('export default function register( {'), 'not a valid ES module'));
  assert.ok(failedWith(run("import x from './x.js';\nexport default function register() {}"), 'ship one self-contained file'));
  assert.ok(failedWith(run("export default function register() { throw new Error('boom'); }"), 'boom'));
  assert.ok(failedWith(run('export const register = () => {};'), 'export default function register'));
  assert.ok(failedWith(run('export default function register() { return new Promise(() => {}); }'), 'did not finish within 5 seconds'));
});

test('sandbox globals match the app: no fetch, no eval', () => {
  const fetches = run(`export default function register(api) {
  api.commands.add({ id: 'say-hello', label: 'Say hello', handler: () => fetch('https://example.com') });
}`);
  assert.ok(fetches.warnings.some((w) => w.includes('calls fetch()')));
  assert.ok(fetches.warnings.some((w) => w.includes('fetch is not defined')));
  const evals = run(`export default function register() { eval('1 + 1'); }`);
  assert.ok(failedWith(evals, 'Code generation from strings disallowed'));
});

test('a loop that never ends is stopped', () => {
  const started = Date.now();
  assert.ok(failedWith(run('export default function register() { for (;;) {} }'), 'timed out'));
  assert.ok(Date.now() - started < 20_000);
});

test('the starter template passes every check it will face in plugins/', async () => {
  const { readFileSync } = await import('node:fs');
  const { manifestProblems } = await import('../lib/rules.mjs');
  const template = new URL('../../template/', import.meta.url);
  const templateManifest = JSON.parse(readFileSync(new URL('manifest.json', template), 'utf8'));
  assert.deepEqual(manifestProblems(templateManifest, 'my-plugin'), []);
  const result = smokeTest(template.pathname);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.commands, ['insert-greeting', 'count-words']);
});

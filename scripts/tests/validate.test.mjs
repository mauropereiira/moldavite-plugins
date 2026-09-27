import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { validate } from '../validate.mjs';
import { writeEntry } from '../registry-entry.mjs';
import { makeRepo, manifest } from './helpers.mjs';

const has = (errors, text) => errors.some((error) => error.includes(text));

test('a well-formed repository passes', () => {
  assert.deepEqual(validate({ root: makeRepo([{ manifest: manifest() }]) }), []);
});

test('hash, mirror and listing mistakes are caught', () => {
  const root = makeRepo([{ manifest: manifest() }], {
    entryOverrides: { 'hello-world': { name: 'Different', files: { 'manifest.json': { sha256: 'a'.repeat(64) }, 'plugin.js': { sha256: 'b'.repeat(64) } } } },
  });
  const errors = validate({ root });
  assert.ok(has(errors, 'registry name "Different" does not match'));
  assert.ok(has(errors, 'manifest.json hash is'));
  assert.ok(has(errors, 'plugin.js hash is'));
});

test('folders and entries must pair up, once each, in id order', () => {
  const root = makeRepo([{ manifest: manifest() }, { manifest: manifest({ id: 'another' }) }]);
  const registryPath = join(root, 'registry.json');
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  registry.plugins = [registry.plugins[1], registry.plugins[0], registry.plugins[0], { ...registry.plugins[0], id: 'ghost', path: 'plugins/ghost' }];
  writeFileSync(registryPath, JSON.stringify(registry));
  mkdirSync(join(root, 'plugins', 'orphan'));
  const errors = validate({ root });
  assert.ok(has(errors, 'sorted by id'));
  assert.ok(has(errors, 'listed more than once'));
  assert.ok(has(errors, 'ghost: is listed but plugins/ghost/ does not exist'));
  assert.ok(has(errors, 'orphan: has a folder but no registry.json entry'));
});

test('plugin folders hold only reviewable files', () => {
  const root = makeRepo([
    { manifest: manifest(), readme: null, extra: { 'bundle.min.js': 'x', 'package.json': '{}' }, code: `export default function register() {}\n// ${'x'.repeat(1200)}\n` },
  ]);
  symlinkSync('/etc/hosts', join(root, 'plugins', 'hello-world', 'LICENSE'));
  const errors = validate({ root });
  assert.ok(has(errors, 'README.md is missing'));
  assert.ok(has(errors, 'bundle.min.js is not allowed'));
  assert.ok(has(errors, 'LICENSE is a link'));
  assert.ok(has(errors, 'unminified source'));
});

test('links are reported and never followed, so a runner file cannot reach the log', () => {
  const root = makeRepo([{ manifest: manifest() }]);
  const dir = join(root, 'plugins', 'hello-world');
  writeFileSync(join(root, 'secret.txt'), 'RUNNER SECRET');
  rmSync(join(dir, 'manifest.json'));
  symlinkSync(join(root, 'secret.txt'), join(dir, 'manifest.json'));
  const errors = validate({ root });
  assert.ok(has(errors, 'manifest.json is a link'));
  assert.ok(!errors.some((error) => error.includes('RUNNER SECRET')));
});

test('a changed plugin must raise its version', () => {
  const base = makeRepo([{ manifest: manifest() }]);
  const baseRegistryText = readFileSync(join(base, 'registry.json'), 'utf8');
  const sameVersion = makeRepo([{ manifest: manifest(), code: 'export default function register() {}\n' }]);
  assert.ok(has(validate({ root: sameVersion, baseRegistryText }), 'version 1.0.0 is not higher than 1.0.0'));
  const bumped = makeRepo([{ manifest: manifest({ version: '1.0.1' }), code: 'export default function register() {}\n' }]);
  assert.ok(!has(validate({ root: bumped, baseRegistryText }), 'is not higher'));
  assert.deepEqual(validate({ root: base, baseRegistryText }), []);
});

test('npm run registry writes an entry the validator accepts', () => {
  const root = makeRepo([{ manifest: manifest() }]);
  writeFileSync(join(root, 'plugins', 'hello-world', 'plugin.js'), 'export default function register() {}\n');
  writeFileSync(join(root, 'plugins', 'hello-world', 'manifest.json'), JSON.stringify(manifest({ version: '1.1.0', commands: undefined, permissions: [] })));
  assert.ok(validate({ root }).length > 0);
  const entry = writeEntry(root, 'hello-world');
  assert.equal(entry.version, '1.1.0');
  assert.deepEqual(validate({ root }), []);
});

#!/usr/bin/env node
// Checks registry.json and every folder under plugins/ without running any
// plugin code, so it is also safe to run on an untrusted pull request.
//
//   node scripts/validate.mjs                   check this checkout
//   node scripts/validate.mjs --base origin/main   also check versions against a git ref
//   node scripts/validate.mjs --root pr --compare base   check ./pr against the checkout in ./base

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  MAX_REGISTRY_PLUGINS,
  compareSemver,
  manifestProblems,
  mirrorProblems,
  parseSemver,
  registryEntryProblems,
} from './lib/rules.mjs';

const ALLOWED_FILES = new Set(['manifest.json', 'plugin.js', 'README.md', 'LICENSE', 'LICENSE.md', 'CHANGELOG.md']);
const REQUIRED_FILES = ['manifest.json', 'plugin.js', 'README.md'];
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_PLUGIN_BYTES = 1024 * 1024;
const MAX_LINE_LENGTH = 1000;

/**
 * A pull request is untrusted, and the trusted CI job runs this on one: read
 * only regular files, so a link cannot pull a runner file into the log.
 */
function readRegular(path) {
  try {
    const stat = lstatSync(path);
    return stat.isFile() && !stat.isSymbolicLink() ? readFileSync(path) : null;
  } catch {
    return null;
  }
}

function isRealDirectory(path) {
  try {
    const stat = lstatSync(path);
    return stat.isDirectory() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function parseJson(text, label, report) {
  try {
    return JSON.parse(text);
  } catch (error) {
    report(`${label} is not valid JSON: ${error.message}`);
    return undefined;
  }
}

function readRegistry(text, report) {
  const registry = parseJson(text, 'registry.json', report);
  if (registry === undefined) return [];
  if (typeof registry !== 'object' || registry === null || Array.isArray(registry)) {
    report('must be an object');
    return [];
  }
  const extra = Object.keys(registry).filter((key) => key !== 'registryVersion' && key !== 'plugins');
  if (extra.length) report(`unknown top-level fields: ${extra.join(', ')}`);
  if (registry.registryVersion !== 1) report('registryVersion must be 1');
  if (!Array.isArray(registry.plugins)) {
    report('"plugins" must be an array');
    return [];
  }
  if (registry.plugins.length > MAX_REGISTRY_PLUGINS) {
    report(`may list at most ${MAX_REGISTRY_PLUGINS} plugins`);
  }
  return registry.plugins;
}

function checkFolder(root, id, entry, report) {
  const dir = join(root, 'plugins', id);
  const names = readdirSync(dir);
  for (const name of names) {
    const stat = lstatSync(join(dir, name));
    if (stat.isSymbolicLink()) report(`${name} is a link; submit the real file`);
    else if (stat.isDirectory()) report(`${name}/ is a folder; a plugin is a single plugin.js`);
    else if (!ALLOWED_FILES.has(name)) {
      report(`${name} is not allowed here (allowed: ${[...ALLOWED_FILES].join(', ')})`);
    }
  }
  for (const name of REQUIRED_FILES) {
    if (!names.includes(name)) report(`${name} is missing`);
  }
  const manifestBytes = readRegular(join(dir, 'manifest.json'));
  const code = readRegular(join(dir, 'plugin.js'));
  if (!manifestBytes || !code) return;
  if (manifestBytes.length > MAX_MANIFEST_BYTES) report('manifest.json is larger than 64 KB');
  if (code.length > MAX_PLUGIN_BYTES) {
    report('plugin.js is larger than 1 MB; submit readable source, not a bundle of libraries');
  }
  const text = code.toString('utf8');
  if (Buffer.compare(Buffer.from(text, 'utf8'), code) !== 0) report('plugin.js is not UTF-8 text');
  const longLine = text.split('\n').findIndex((line) => line.length > MAX_LINE_LENGTH);
  if (longLine !== -1) {
    report(`plugin.js line ${longLine + 1} is over ${MAX_LINE_LENGTH} characters; submit readable, unminified source`);
  }

  const manifest = parseJson(manifestBytes.toString('utf8'), 'manifest.json', report);
  if (manifest === undefined) return;
  manifestProblems(manifest, id).forEach((problem) => report(`manifest.json: ${problem}`));
  if (!entry) return;
  mirrorProblems(entry, manifest).forEach(report);
  if (entry.files?.['manifest.json']?.sha256 !== sha256(manifestBytes)) {
    report(`manifest.json hash is ${sha256(manifestBytes)}, registry says ${entry.files?.['manifest.json']?.sha256}; run npm run registry -- ${id}`);
  }
  if (entry.files?.['plugin.js']?.sha256 !== sha256(code)) {
    report(`plugin.js hash is ${sha256(code)}, registry says ${entry.files?.['plugin.js']?.sha256}; run npm run registry -- ${id}`);
  }
}

/** A plugin whose files changed must move to a higher version, or installed copies never see the update. */
function checkVersions(entries, baseEntries, report) {
  const base = new Map(baseEntries.filter((entry) => entry && typeof entry.id === 'string').map((entry) => [entry.id, entry]));
  for (const entry of entries) {
    const before = base.get(entry?.id);
    if (!before) continue;
    const changed =
      before.files?.['manifest.json']?.sha256 !== entry.files?.['manifest.json']?.sha256 ||
      before.files?.['plugin.js']?.sha256 !== entry.files?.['plugin.js']?.sha256;
    if (!changed || !parseSemver(entry.version) || !parseSemver(before.version)) continue;
    if (compareSemver(entry.version, before.version) <= 0) {
      report(entry.id, `files changed but version ${entry.version} is not higher than ${before.version}`);
    }
  }
}

export function validate({ root, baseRegistryText = null }) {
  const errors = [];
  const report = (scope) => (message) => errors.push(`${scope}: ${message}`);
  const general = report('registry.json');

  const registryBytes = readRegular(join(root, 'registry.json'));
  if (!registryBytes) {
    general('registry.json is missing or is not a regular file');
    return errors;
  }
  const entries = readRegistry(registryBytes.toString('utf8'), general);

  const seen = new Set();
  const listed = [];
  entries.forEach((entry, index) => {
    const scope = typeof entry?.id === 'string' ? entry.id : `entry ${index + 1}`;
    registryEntryProblems(entry).forEach(report(scope));
    if (typeof entry?.id !== 'string') return;
    if (seen.has(entry.id)) report(scope)('is listed more than once');
    seen.add(entry.id);
    listed.push(entry.id);
  });
  const sorted = [...listed].sort();
  if (listed.join() !== sorted.join()) general('entries must be sorted by id (npm run registry keeps them sorted)');

  let folders = [];
  if (isRealDirectory(join(root, 'plugins'))) folders = readdirSync(join(root, 'plugins'));
  else general('plugins/ is missing or is not a real folder');
  for (const name of folders) {
    const stat = lstatSync(join(root, 'plugins', name));
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      report(`plugins/${name}`)('only plugin folders belong in plugins/');
      continue;
    }
    const entry = entries.find((candidate) => candidate?.id === name);
    if (!entry) report(name)('has a folder but no registry.json entry; run npm run registry -- ' + name);
    checkFolder(root, name, entry, report(name));
  }
  for (const id of listed) {
    if (!folders.includes(id)) report(id)(`is listed but plugins/${id}/ does not exist`);
  }

  if (baseRegistryText !== null) {
    const baseEntries = readRegistry(baseRegistryText, () => {});
    checkVersions(entries, baseEntries, (id, message) => report(id)(message));
  }
  return errors;
}

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
}

function main() {
  const args = process.argv.slice(2);
  const root = resolve(option(args, '--root') ?? '.');
  const baseRef = option(args, '--base');
  const compareDir = option(args, '--compare');
  let baseRegistryText = null;
  if (compareDir) {
    baseRegistryText = readRegular(join(resolve(compareDir), 'registry.json'))?.toString('utf8') ?? null;
  } else if (baseRef) {
    baseRegistryText = execFileSync('git', ['show', `${baseRef}:registry.json`], { cwd: root, encoding: 'utf8' });
  }

  const errors = validate({ root, baseRegistryText });
  if (errors.length) {
    console.error(`✗ ${errors.length} problem${errors.length === 1 ? '' : 's'}:\n`);
    for (const error of errors) console.error(`  - ${error}`);
    console.error('\nSee CONTRIBUTING.md for the rules.');
    process.exit(1);
  }
  const count = readdirSync(join(root, 'plugins')).length;
  console.log(`✓ registry.json and ${count} plugin${count === 1 ? '' : 's'} are valid`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();

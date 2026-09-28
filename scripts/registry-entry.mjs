#!/usr/bin/env node
// Writes a plugin's registry.json entry from its folder, with both SHA-256
// hashes, so the entry always says exactly what the files say.
//
//   node scripts/registry-entry.mjs <plugin-id>

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isPluginId, manifestProblems } from './lib/rules.mjs';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function buildEntry(root, id) {
  const dir = join(root, 'plugins', id);
  const manifestBytes = readFileSync(join(dir, 'manifest.json'));
  const code = readFileSync(join(dir, 'plugin.js'));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const problems = manifestProblems(manifest, id);
  if (problems.length) throw new Error(`manifest.json is not valid:\n  - ${problems.join('\n  - ')}`);
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    apiVersion: manifest.apiVersion,
    ...(manifest.minAppVersion === undefined ? {} : { minAppVersion: manifest.minAppVersion }),
    permissions: manifest.permissions ?? [],
    allowedHosts: manifest.allowedHosts ?? [],
    files: {
      'manifest.json': { sha256: sha256(manifestBytes) },
      'plugin.js': { sha256: sha256(code) },
    },
    path: `plugins/${id}`,
  };
}

export function writeEntry(root, id) {
  const path = join(root, 'registry.json');
  const registry = JSON.parse(readFileSync(path, 'utf8'));
  const entry = buildEntry(root, id);
  const plugins = registry.plugins.filter((existing) => existing.id !== id);
  plugins.push(entry);
  plugins.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  writeFileSync(path, `${JSON.stringify({ registryVersion: 1, plugins }, null, 2)}\n`);
  return entry;
}

function main() {
  const id = process.argv[2];
  if (!isPluginId(id)) {
    console.error('Usage: npm run registry -- <plugin-id>   (the folder name under plugins/)');
    process.exit(1);
  }
  try {
    const entry = writeEntry(resolve('.'), id);
    console.log(`✓ registry.json lists ${entry.id} ${entry.version}`);
  } catch (error) {
    console.error(`✗ ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();

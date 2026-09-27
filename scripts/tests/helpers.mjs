import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const sha256 = (text) => createHash('sha256').update(text).digest('hex');

export function manifest(overrides = {}) {
  return {
    id: 'hello-world',
    name: 'Hello World',
    version: '1.0.0',
    author: 'Someone',
    description: 'Says hello.',
    apiVersion: 2,
    minAppVersion: '2.10.0',
    permissions: ['commands', 'ui'],
    commands: [{ id: 'say-hello', label: 'Say hello' }],
    ...overrides,
  };
}

export const HELLO_CODE = `export default function register(api) {
  api.commands.add({
    id: 'say-hello',
    label: 'Say hello',
    handler: async () => {
      await api.ui.toast('Hello');
    },
  });
}
`;

/** A throwaway directory repository holding the given plugins, with a matching registry. */
export function makeRepo(plugins, { entryOverrides = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'moldavite-plugins-test-'));
  mkdirSync(join(root, 'plugins'));
  const entries = [];
  for (const { manifest: m, code = HELLO_CODE, readme = '# Plugin\n', extra = {} } of plugins) {
    const dir = join(root, 'plugins', m.id);
    mkdirSync(dir);
    const manifestText = `${JSON.stringify(m, null, 2)}\n`;
    writeFileSync(join(dir, 'manifest.json'), manifestText);
    writeFileSync(join(dir, 'plugin.js'), code);
    if (readme !== null) writeFileSync(join(dir, 'README.md'), readme);
    for (const [name, body] of Object.entries(extra)) writeFileSync(join(dir, name), body);
    entries.push({
      id: m.id,
      name: m.name,
      version: m.version,
      description: m.description,
      author: m.author,
      apiVersion: m.apiVersion,
      ...(m.minAppVersion === undefined ? {} : { minAppVersion: m.minAppVersion }),
      permissions: m.permissions ?? [],
      allowedHosts: m.allowedHosts ?? [],
      files: {
        'manifest.json': { sha256: sha256(manifestText) },
        'plugin.js': { sha256: sha256(code) },
      },
      path: `plugins/${m.id}`,
      ...(entryOverrides[m.id] ?? {}),
    });
  }
  entries.sort((a, b) => (a.id < b.id ? -1 : 1));
  writeFileSync(join(root, 'registry.json'), JSON.stringify({ registryVersion: 1, plugins: entries }, null, 2));
  return root;
}

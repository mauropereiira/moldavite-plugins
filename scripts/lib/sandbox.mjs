// Loads one plugin the way Moldavite does and reports what happened, as one
// line of JSON on stdout. Run by scripts/smoke.mjs in its own process, with
// `--experimental-vm-modules`, a memory cap and a deadline.
//
// This imitates Moldavite's sandbox for testing: the same allowlisted globals
// and the same permission checks, over a fake API. `node:vm` is not a security
// boundary, which is why CI runs this with no secrets and a read-only token.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const APP_VERSION = '2.10.0';
const STEP_MS = 5000;
const SAMPLE_NOTE = {
  path: 'notes/Smoke test.md',
  title: 'Smoke test',
  content: '<h1>Smoke test</h1><p>Sample note text for the plugin smoke test.</p>',
};
const PROMPT_FIELD_TYPES = ['text', 'password', 'url'];
const SECRET_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const dir = process.argv[2];
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
const source = readFileSync(join(dir, 'plugin.js'), 'utf8');
const permissions = manifest.permissions ?? [];
const allowedHosts = manifest.allowedHosts ?? [];
const failures = [];
const warnings = [];
const registered = new Map();

const fail = (message) => {
  if (!failures.includes(message)) failures.push(message);
};
const warn = (message) => {
  if (!warnings.includes(message)) warnings.push(message);
};

function finish() {
  process.stdout.write(
    `${JSON.stringify({ failures, warnings, commands: [...registered.keys()] })}\n`
  );
  process.exit(0);
}

function need(permission, method) {
  if (permissions.includes(permission)) return;
  const message = `calls api.${method} without the "${permission}" permission in manifest.json`;
  fail(message);
  throw new Error(message);
}

function checkPrompt(options) {
  const problem = (() => {
    if (typeof options !== 'object' || options === null) return 'options must be an object';
    const { title, fields } = options;
    if (typeof title !== 'string' || !title.trim() || title.length > 200) {
      return 'title must be 1 to 200 characters';
    }
    if (!Array.isArray(fields) || fields.length < 1 || fields.length > 12) {
      return 'fields must hold 1 to 12 entries';
    }
    for (const field of fields) {
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(field?.name ?? '')) return 'a field name is invalid';
      if (typeof field.label !== 'string' || !field.label || field.label.length > 160) {
        return 'a field label must be 1 to 160 characters';
      }
      if (!PROMPT_FIELD_TYPES.includes(field.type)) return 'a field type must be text, password or url';
    }
    return null;
  })();
  if (problem) throw new Error(`ui.prompt rejected: ${problem}`);
}

function checkUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`net.fetch rejected: "${url}" is not an absolute URL`);
  }
  if (parsed.protocol !== 'https:') throw new Error('net.fetch rejected: only https URLs are allowed');
  if (parsed.username || parsed.password) throw new Error('net.fetch rejected: no credentials in URLs');
  if (!allowedHosts.includes(parsed.hostname)) {
    warn(
      `fetches ${parsed.hostname}, which is not in allowedHosts; that only works after the user approves it through api.net.requestHostAccess`
    );
    throw new Error(`net.fetch rejected: ${parsed.hostname} is not an approved host`);
  }
}

function buildApi() {
  const api = {
    app: Object.freeze({ version: APP_VERSION, apiVersion: manifest.apiVersion }),
    commands: {
      add(command) {
        need('commands', 'commands.add');
        if (
          typeof command?.id !== 'string' ||
          typeof command?.label !== 'string' ||
          typeof command?.handler !== 'function'
        ) {
          throw new Error('commands.add expects { id, label, handler }');
        }
        registered.set(command.id, command);
      },
    },
    editor: {
      async getActiveNote() {
        need('editor', 'editor.getActiveNote');
        return { ...SAMPLE_NOTE };
      },
      async insertText(text) {
        need('editor', 'editor.insertText');
        if (typeof text !== 'string') throw new Error('editor.insertText expects a string');
      },
    },
    ui: {
      async toast(message) {
        need('ui', 'ui.toast');
        if (typeof message !== 'string') throw new Error('ui.toast expects a string message');
      },
    },
  };
  if (manifest.apiVersion < 2) return api;
  return Object.assign(api, {
    ui: {
      ...api.ui,
      async prompt(options) {
        need('ui', 'ui.prompt');
        checkPrompt(options);
        return null;
      },
    },
    notes: {
      async list() {
        need('notes.read', 'notes.list');
        return [{ path: SAMPLE_NOTE.path, title: SAMPLE_NOTE.title, kind: 'standalone', folder: null }];
      },
      async read(path) {
        need('notes.read', 'notes.read');
        if (path !== SAMPLE_NOTE.path) throw new Error('notes.read rejected: unknown note path');
        return '# Smoke test\n\nSample note text for the plugin smoke test.\n';
      },
    },
    net: {
      async fetch(url) {
        need('net.fetch', 'net.fetch');
        checkUrl(url);
        return { status: 200, headers: { 'content-type': 'application/json' }, bodyText: '{}' };
      },
      async requestHostAccess(host) {
        need('net.fetch', 'net.requestHostAccess');
        return allowedHosts.includes(host);
      },
    },
    secrets: {
      async get(key) {
        need('secrets', 'secrets.get');
        if (!SECRET_KEY_RE.test(key ?? '')) throw new Error('secrets.get rejected: invalid key');
        return null;
      },
      async set(key, value) {
        need('secrets', 'secrets.set');
        if (!SECRET_KEY_RE.test(key ?? '') || typeof value !== 'string') {
          throw new Error('secrets.set rejected: invalid key or value');
        }
      },
      async delete(key) {
        need('secrets', 'secrets.delete');
        if (!SECRET_KEY_RE.test(key ?? '')) throw new Error('secrets.delete rejected: invalid key');
      },
    },
  });
}

/** Calls into the sandbox so a loop that never yields is cut off after STEP_MS too. */
function callInSandbox(context, fn, arg) {
  context.__call = fn;
  context.__arg = arg;
  try {
    return vm.runInContext('__call(__arg)', context, { timeout: STEP_MS });
  } finally {
    delete context.__call;
    delete context.__arg;
  }
}

function withDeadline(promise, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), STEP_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

function sandboxGlobals() {
  const quiet = () => {};
  const globals = {
    console: { log: quiet, info: quiet, warn: quiet, error: quiet, debug: quiet },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    structuredClone,
    TextEncoder,
    TextDecoder,
    atob,
    btoa,
    crypto: globalThis.crypto,
    performance: Object.freeze({ now: () => performance.now() }),
    URL,
    URLSearchParams,
    Blob,
    navigator: Object.freeze({
      userAgent: 'Moldavite plugin smoke test',
      language: 'en-US',
      languages: Object.freeze(['en-US']),
      hardwareConcurrency: 4,
    }),
  };
  globals.globalThis = globals;
  globals.self = globals;
  return globals;
}

const UNAVAILABLE = [
  [/(?<![.\w$])fetch\s*\(/, 'calls fetch(), which Moldavite removes; use api.net.fetch'],
  [/\bXMLHttpRequest\b/, 'uses XMLHttpRequest, which Moldavite removes; use api.net.fetch'],
  [/\bWebSocket\b/, 'uses WebSocket, which Moldavite removes'],
  [/\bimportScripts\b/, 'uses importScripts, which Moldavite removes'],
  [/\b(?:localStorage|sessionStorage|indexedDB)\b/, 'uses browser storage, which Moldavite removes'],
  [/\b(?:document|window)\.\w/, 'uses document or window; plugins run in a worker with no page'],
  [/\beval\s*\(|\bnew\s+Function\s*\(/, 'builds code from strings (eval or new Function)'],
];

async function main() {
  for (const [pattern, message] of UNAVAILABLE) {
    if (pattern.test(source)) warn(message);
  }

  process.on('unhandledRejection', (reason) => {
    warn(`left a promise rejection unhandled: ${reason instanceof Error ? reason.message : String(reason)}`);
  });

  const context = vm.createContext(sandboxGlobals(), {
    codeGeneration: { strings: false, wasm: false },
  });
  let module;
  try {
    module = new vm.SourceTextModule(source, {
      context,
      identifier: 'plugin.js',
      importModuleDynamically: () => {
        throw new Error('plugins cannot import other code');
      },
    });
  } catch (error) {
    fail(`plugin.js is not a valid ES module: ${error.message}`);
    return finish();
  }
  if (module.dependencySpecifiers.length > 0) {
    fail(`plugin.js imports ${module.dependencySpecifiers.join(', ')}; ship one self-contained file`);
    return finish();
  }

  const api = buildApi();
  try {
    await module.link(() => {
      throw new Error('imports are not allowed');
    });
    await module.evaluate({ timeout: STEP_MS });
    const register = module.namespace.default;
    if (typeof register !== 'function') {
      fail('plugin.js must `export default function register(api)`');
      return finish();
    }
    await withDeadline(
      Promise.resolve(callInSandbox(context, register, api)),
      'register(api) did not finish within 5 seconds'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!failures.includes(message)) fail(`failed while loading: ${message}`);
    return finish();
  }

  const declared = (manifest.commands ?? []).map((command) => command.id);
  const ids = [...registered.keys()];
  if (manifest.commands) {
    for (const id of declared) {
      if (!registered.has(id)) fail(`manifest.json declares command "${id}" but the plugin never registers it`);
    }
    for (const id of ids) {
      if (!declared.includes(id)) fail(`registers command "${id}" that manifest.json does not declare`);
    }
  } else if (ids.length > 0) {
    warn('registers commands without declaring them in manifest.json, so people cannot see them before turning it on');
  }

  for (const [id, command] of registered) {
    try {
      await withDeadline(
        Promise.resolve(callInSandbox(context, command.handler)),
        `command "${id}" did not finish within 5 seconds`
      );
    } catch (error) {
      warn(
        `command "${id}" failed with the sample data: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  finish();
}

main().catch((error) => {
  fail(`the smoke test itself failed: ${error instanceof Error ? error.message : String(error)}`);
  finish();
});

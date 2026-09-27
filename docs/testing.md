# Testing a plugin

## npm scripts

Node 20 or later. There is no install step: this repository has no dependencies, so you can
run every script right after cloning.

| Script | Runs | Checks |
| --- | --- | --- |
| `npm run validate` | `node scripts/validate.mjs` | `registry.json` is well-formed and sorted, every `plugins/<id>/` folder matches exactly one registry entry, folder contents and file sizes obey the rules in [docs/plugin-format.md](plugin-format.md), and `manifest.json` passes every manifest rule. Runs without executing any plugin code, so it is safe on an untrusted pull request. |
| `npm run smoke` | `node scripts/smoke.mjs [id...]` | Loads every plugin (or only the ids you pass) in the sandbox harness described below, one process per plugin. Fails a plugin that cannot load, that registers commands its manifest does not declare (or the reverse), or that calls an API method without the permission for it. |
| `npm run check` | `validate` then `smoke` | Both of the above. Run this before every pull request; it is also what the "Validate plugins" check runs. |
| `npm run registry -- <id>` | `node scripts/registry-entry.mjs <id>` | Not a check: writes `<id>`'s entry in `registry.json` from its current `manifest.json` and `plugin.js`, including both SHA-256 hashes. Run it after every change to your plugin's files. |
| `npm test` | `node --test scripts/tests/*.test.mjs` | Unit tests for this repository's own tooling (`rules.mjs`, `validate.mjs`, `smoke.mjs`), not for your plugin. They confirm the manifest rules match what the app enforces, the sandbox rejects what the app's sandbox rejects, and the validator catches hash, mirror, folder, and versioning mistakes. |

## The smoke test's fake API

`scripts/lib/sandbox.mjs` runs your `plugin.js` in a real `node:vm` context with the same
allowlisted globals as Moldavite's plugin worker, so code that uses `fetch`, `eval`,
`document`, or similar is flagged the same way it would be in the app. `node:vm` is not a
security boundary, which is why CI runs it with a read-only token and no secrets, and why you
should still review any plugin's code yourself.

Instead of the real app, a fake `api` answers your plugin's calls with fixed sample data:

- `editor.getActiveNote()` returns one sample note (`notes/Smoke test.md`) with a fixed title
  and HTML content. `notes.list()` and `notes.read()` return metadata and Markdown for that
  same note; any other path rejects.
- `ui.prompt()` checks its `options` against the app's main limits (title, 1 to 12 fields,
  field names, labels and types), then always returns `null`, as if the person cancelled.
- `net.fetch()` returns `{ status: 200, headers: { 'content-type': 'application/json' },
  bodyText: '{}' }` for a host listed in your manifest's `allowedHosts`, and rejects any other
  host.
- `net.requestHostAccess(host)` returns `true` only for a host already in `allowedHosts`, and
  `false` otherwise; there is no real person to approve a new one.
- `secrets.get()` always returns `null`. `secrets.set()` and `secrets.delete()` validate the
  key and value and otherwise do nothing.
- Calling any method without its required permission in `manifest.json` fails immediately,
  the same way the app would refuse it.

## Failures versus notes

The smoke test prints two kinds of things, and only one of them fails the build:

- **Failures** stop the plugin from passing: `plugin.js` is not a valid ES module, it imports
  other code, it has no default `register` export, `register` throws or never settles,
  declared and registered commands do not match, or a method is called without its
  permission.
- **Notes** (printed as `note: ...`) are warnings that do not fail the run: your source text
  matches a pattern for an API Moldavite removes (`fetch`, `XMLHttpRequest`, `WebSocket`,
  browser storage, `document`/`window`, `eval`, `new Function`), a command handler threw when
  run with the sample data, a plugin registered commands without declaring any in the
  manifest, or a promise rejection was left unhandled. A command handler failing with the
  sample data is only ever a note, never a failure, because the sample data may not be what
  your command actually needs (a command that expects a prompt answer first, for example).

Read every note. A note today is often the reason a reviewer asks a question later.

## Testing inside Moldavite

The smoke test tells you your plugin loads; it does not tell you it feels right. Use
**Settings → Plugins → Install from folder…** and pick your `plugins/<id>` folder, then run
its commands from the command palette (`Cmd+P` or `Ctrl+P`) or the editor slash menu.

Consent is pinned to the exact bytes of `manifest.json` and `plugin.js`, so after every edit
you install the folder again (or reopen Settings if you copied it into `<Forge>/.plugins/`)
and approve it again before it runs with your changes. Add `api.ui.toast()` calls while you
iterate: it is the simplest way to see what your plugin is doing in the real app. (The smoke
test accepts toasts but does not print them.)

## If a test plugin breaks Moldavite

The same recovery options apply to a plugin you are developing as to any other:
**Settings → Plugins → Stop all plugins**, safe mode from the command line, or, as a last
resort, moving the plugin's folder out of `<Forge>/.plugins/`. See
[Moldavite's "If a plugin stops Moldavite from working"](https://github.com/mauropereiira/Moldavite/blob/main/docs/PLUGINS.md#if-a-plugin-stops-moldavite-from-working)
for the full steps.

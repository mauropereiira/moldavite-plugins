# AGENTS.md

Rules for an AI coding agent adding or updating a plugin in this repository. A person doing
the same thing should read [CONTRIBUTING.md](CONTRIBUTING.md) instead; this file gives the
same process as short, exact commands.

## Goal and file layout

Add or update exactly one plugin at `plugins/<id>/` and its matching entry in
`registry.json`, following [docs/plugin-format.md](docs/plugin-format.md) and the API in
[docs/api.md](docs/api.md).

```text
plugins/<id>/
├── manifest.json
├── plugin.js
└── README.md
```

`<id>` is lowercase letters, digits, and hyphens, and must equal the folder name. Node 20 or
later. No install step: this repository has no dependencies.

## Steps

1. Copy the template: `cp -r template plugins/<id>`
2. Edit `plugins/<id>/manifest.json`: `id` (= folder name), `name`, `version`, `author`,
   `description`, `apiVersion`, `permissions`, `allowedHosts` (only together with
   `net.fetch`), `commands`, `instructions`.
3. Write `plugins/<id>/plugin.js`: one self-contained ES module with a default
   `register(api)` export, using only the API in [docs/api.md](docs/api.md).
4. Write `plugins/<id>/README.md`: what it does; what it can reach (each permission and why,
   and for `net.fetch`, each host, what is sent, and why); how to use it; what it stores and
   the command that deletes it, if it stores anything.
5. Run `npm run registry -- <id>` to write the registry entry and both file hashes. Run it
   again after every change to `manifest.json` or `plugin.js`; the checks compare the hashes.
6. Run `npm run check && npm test`. Fix every failure, rerun step 5 after each fix, and do not
   proceed while either command fails.
7. Open the pull request, or hand the branch to the human, stating that an AI coding agent
   prepared it and that a human reviewed the result. Only a person can try the plugin in
   Moldavite (**Settings → Plugins → Install from folder…**); say whether that happened.

## Hard rules

- Edit only `plugins/<id>/` and its entry in `registry.json`. Touch no other plugin.
- Never hand-edit `registry.json` or its hashes. Always run `npm run registry -- <id>`.
- Never edit `scripts/`, `.github/`, or another plugin's folder unless the human running you
  asks for it.
- Add no dependencies, no build step, and no files beyond `manifest.json`, `plugin.js`, and
  `README.md` (plus an optional license file).
- Never use `fetch`, `XMLHttpRequest`, `WebSocket`, `eval`, `new Function`, `import`, or
  `importScripts` in `plugin.js`. Use `api.net.fetch` for network requests.
- Ship one self-contained `plugin.js`. Do not split it into multiple files or load code from a
  URL.
- Declare exactly the permissions your code calls: no unused permission, no undeclared call.
- Make manifest `commands` match exactly what `plugin.js` registers with
  `api.commands.add`, in both directions.
- Raise `version` in `manifest.json` on any change to it or to `plugin.js`.
- Run `npm run check && npm test` yourself before saying they pass. Never claim a check
  passed without having run it in this session.
- State in the pull request that an AI coding agent prepared it and that a human reviewed it.

## API quick reference

| Method | Permission | API version |
| --- | --- | --- |
| `app.version` | none | 1 and 2 |
| `app.apiVersion` | none | 1 and 2 |
| `commands.add(command)` | `commands` | 1 and 2 |
| `editor.getActiveNote()` | `editor` | 1 and 2 |
| `editor.insertText(text)` | `editor` | 1 and 2 |
| `ui.toast(message, kind?)` | `ui` | 1 and 2 |
| `ui.prompt(options)` | `ui` | 2 only |
| `notes.list()` | `notes.read` | 2 only |
| `notes.read(path)` | `notes.read` | 2 only |
| `net.requestHostAccess(host)` | `net.fetch` | 2 only |
| `net.fetch(url, options?)` | `net.fetch` | 2 only |
| `secrets.get(key)` | `secrets` | 2 only |
| `secrets.set(key, value)` | `secrets` | 2 only |
| `secrets.delete(key)` | `secrets` | 2 only |

Full reference: [docs/api.md](docs/api.md).

## Common messages and their fix

### From `npm run validate` (manifest rules)

| Message | Fix |
| --- | --- |
| `unknown manifest field "X"` | Remove it. Only the fields in [docs/plugin-format.md](docs/plugin-format.md) are allowed. |
| `id "X" must be lowercase letters, digits and hyphens, up to 64 characters` | Fix `id`'s format. |
| `id "X" must match its folder name "Y"` | Rename the folder or fix `id` so they match. |
| `version "X" must be a semantic version such as 1.0.0` | Use `MAJOR.MINOR.PATCH`. |
| `apiVersion X is not supported (use 1 or 2)` | Set `apiVersion` to `1` or `2`. |
| `unknown permission "X" (supported: ...)` | Use only the permissions listed in [docs/api.md](docs/api.md). |
| `"X" needs apiVersion 2` | Set `apiVersion: 2`, or drop the permission. |
| `net.fetch needs at least one allowedHosts entry` | Add the exact host(s) your code calls. |
| `allowedHosts is only used with the net.fetch permission` | Remove `allowedHosts`, or add `net.fetch` to `permissions`. |
| `allowedHosts entry "X" must be an exact lowercase hostname, with no scheme, port, path, IP address, wildcard or localhost` | Use a bare hostname, such as `api.example.com`. |
| `each command must be { "id", "label" } with non-empty, bounded strings` | Fix the shape of the `commands` entry. |
| `command ids must be unique` | Remove the duplicate id. |
| `declaring commands needs the "commands" permission` | Add `"commands"` to `permissions`. |

### From `npm run validate` (folder and registry)

| Message | Fix |
| --- | --- |
| `X is not allowed here (allowed: manifest.json, plugin.js, README.md, LICENSE, LICENSE.md, CHANGELOG.md)` | Remove the file. |
| `X is missing` | Add the required file. |
| `X/ is a folder; a plugin is a single plugin.js` | Remove the subfolder; flatten your code into one file. |
| `plugin.js is larger than 1 MB; submit readable source, not a bundle of libraries` | Remove bundled dependencies; keep it self-contained. |
| `plugin.js line N is over 1000 characters; submit readable, unminified source` | Do not minify; reformat long lines. |
| `manifest.json hash is X, registry says Y; run npm run registry -- <id>` | Run `npm run registry -- <id>`. |
| `has a folder but no registry.json entry; run npm run registry -- <id>` | Run `npm run registry -- <id>`. |
| `registry X does not match manifest.json Y` | Run `npm run registry -- <id>`; never hand-edit `registry.json`. |
| `listed plugins need a description and an author in manifest.json` | Add `description` and `author` to `manifest.json`, then rerun `npm run registry -- <id>`. |
| `files changed but version X is not higher than Y` | Raise `version` in `manifest.json`, then rerun `npm run registry -- <id>`. |
| `entries must be sorted by id (npm run registry keeps them sorted)` | Run `npm run registry -- <id>` instead of editing `registry.json` by hand. |

### From `npm run smoke`

| Message | Fix |
| --- | --- |
| `calls api.X without the "Y" permission in manifest.json` | Add the permission, or remove the call. |
| `plugin.js is not a valid ES module: ...` | Fix the syntax error. |
| `plugin.js imports X; ship one self-contained file` | Inline the code; remove the `import`. |
| `` plugin.js must `export default function register(api)` `` | Add the default export. |
| `register(api) did not finish within 5 seconds` | Make `register()` return quickly; do not block in setup. |
| `manifest.json declares command "X" but the plugin never registers it` | Call `api.commands.add` with that id, or remove it from `manifest.json`. |
| `registers command "X" that manifest.json does not declare` | Add it to `manifest.json`'s `commands` array. |
| `note: calls fetch(), which Moldavite removes; use api.net.fetch` | Replace `fetch()` with `api.net.fetch`. |
| `note: uses XMLHttpRequest / WebSocket / importScripts / browser storage / document or window` | Remove it; none of these exist in the plugin sandbox. |
| `note: builds code from strings (eval or new Function)` | Remove `eval`/`new Function`; there is no dynamic code loading. |
| `did not finish within 30 seconds; look for a loop that never ends` | Find and fix the infinite loop. |

# Contributing a plugin

This is the walkthrough for a person adding or updating a plugin, from forking this
repository to a merged listing. If you are an AI coding agent, read [AGENTS.md](AGENTS.md)
instead: it gives the same rules as short, exact commands.

You need Node 20 or later. There is no install step: this repository has no dependencies, so
`npm run check` and `npm test` work right after you clone it.

## Walkthrough

### 1. Fork and clone

Fork this repository on GitHub, then clone your fork.

### 2. Copy the template

```sh
cp -r template plugins/<your-plugin-id>
```

Your plugin id is also its folder name: lowercase letters, digits, and hyphens, up to 64
characters.

### 3. Set the id

Open `plugins/<your-plugin-id>/manifest.json` and set `id` to match the folder name exactly.
Set `name`, `author`, and `description` too.

### 4. Write the plugin

Edit `plugin.js`. It is a single, self-contained ES module with a default `register(api)`
export; there is no build step and no dependency to install. [docs/api.md](docs/api.md) is the
full reference for what `api` can do and which permission each part needs. Ask for the fewest
permissions your plugin needs, and declare exact hosts in `allowedHosts` if it uses
`net.fetch`.

### 5. Try it in Moldavite

In Moldavite, go to **Settings → Plugins → Install from folder…** and pick your
`plugins/<your-plugin-id>` folder. Review the permission sheet, enable the plugin, and run its
commands from the command palette (`Cmd+P` or `Ctrl+P`) or the editor slash menu.

Approval is pinned to the exact bytes of `manifest.json` and `plugin.js`. After every edit,
install the folder again and approve it again before the change takes effect. Repeat this
step as you iterate.

### 6. Generate the registry entry

```sh
npm run registry -- <your-plugin-id>
```

This writes your plugin's entry in `registry.json` from the files in its folder, including
both SHA-256 hashes. Never edit `registry.json` by hand, and run this command again any time
you change `manifest.json` or `plugin.js`.

### 7. Run the checks

```sh
npm run check
npm test
```

`npm run check` runs the validator and the sandbox smoke test; `npm test` runs this
repository's own tooling tests. Fix every failure, and rerun `npm run registry` after each
fix. Read the notes too, even when they do not fail the run: see
[docs/testing.md](docs/testing.md) for what each one means.

### 8. Write the README

Your plugin's `README.md` is required. Say plainly:

- What the plugin does.
- What it can reach: each permission and why it needs it, and for `net.fetch`, each host, what
  is sent there, and why.
- How to use it.
- What it stores, if anything. If it stores secrets, give a command that deletes them.

### 9. Open the pull request

The [pull request template](.github/pull_request_template.md) asks for:

- **What it does**, in a sentence or two a Moldavite user would understand.
- **What it can reach**, the same permission and host explanation as the README.
- A checklist: one plugin per pull request in `plugins/<id>/` with `manifest.json`,
  `plugin.js`, and `README.md`; `npm run check` and `npm test` passing locally;
  `registry.json` updated with `npm run registry -- <id>`; the version raised for an update;
  that you tried it in Moldavite with **Install from folder…**; readable, unminified source
  with nothing loaded from elsewhere; a README that says what is sent where; and that you can
  license the plugin under MIT or the license you included.

If an AI coding agent prepared the pull request, say which one, and that you reviewed its
work, in the pull request description.

## What the checks do

Two automatic checks run on every pull request, both with a read-only token and no secrets:

- **Validate plugins** (`validate.yml`) runs the pull request's own validator, the sandbox
  smoke test, and this repository's tooling tests.
- **Registry check** (`registry-check.yml`) runs the validator from `main` against the pull
  request's files as data, and runs nothing from the pull request itself. A pull request
  cannot change the check it is judged by.

A green check is a baseline, not the review. See [docs/testing.md](docs/testing.md) for what
each check does, and [docs/review-policy.md](docs/review-policy.md) for what the maintainer
looks at before approving.

## Updating a listed plugin

1. Edit the files in your plugin's folder.
2. Raise `version` in `manifest.json`. See Versioning below.
3. Run `npm run registry -- <your-plugin-id>`, then `npm run check && npm test`.
4. Open a pull request. If you added or dropped a permission or a host, say so: it is what
   installed users will see and have to approve again before the update takes effect.

## Versioning

`version` in `manifest.json` follows semantic versioning, such as `1.2.0`. Any change to
`manifest.json` or `plugin.js` needs a strictly higher version than the version currently
listed; the checks refuse a pull request that changes a plugin's files without raising it.

A patch release (`1.0.0` to `1.0.1`) fits a fix. A minor release (`1.0.0` to `1.1.0`) fits a
new feature. Asking for a new permission or host is shown to installed users on update and
needs their approval, so explain it in the pull request even for a small version bump.

## The rules

- Ask for the fewest permissions your plugin needs.
- Declare exact hosts in `allowedHosts`, not broad ones.
- Load no code from elsewhere: no dynamic `import`, no `eval`, no `new Function`.
- Keep `plugin.js` readable and unminified. You should be able to explain every line of it.
- No analytics, tracking, ads, or telemetry.
- Say in the README what the plugin sends where and what it stores, with a command that
  deletes anything it stores in `secrets`.
- Keep content suitable for all ages.
- One plugin per pull request.
- Never edit another author's plugin.
- License your plugin MIT by default, or include an OSI-approved license file in its folder.

## Removal

The maintainer can remove a listing that breaks these rules. Removing a listing does not
reach anyone who already installed the plugin: their installed copy keeps working until they
uninstall it themselves, because Moldavite never updates or turns on a plugin on its own.

## Full example: the starter template

This is `template/manifest.json` and `template/plugin.js` in full. Copying `template/` gives
you exactly this, ready to rename and edit.

`template/manifest.json`:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "Inserts a greeting and counts the words in the open note.",
  "apiVersion": 2,
  "minAppVersion": "2.9.0",
  "permissions": ["commands", "editor", "ui"],
  "commands": [
    { "id": "insert-greeting", "label": "Insert a greeting" },
    { "id": "count-words", "label": "Count words in this note" }
  ],
  "instructions": [
    "Turn the plugin on in **Settings → Plugins** and approve what it asks for.",
    "Open a note, press `Cmd+P` (`Ctrl+P` on Windows and Linux), and run **Insert a greeting** or **Count words in this note**."
  ]
}
```

`template/plugin.js`:

```js
// A starter Moldavite plugin. Rename the folder and the manifest id, then
// replace these two commands with your own. docs/api.md lists all of `api`.

export default function register(api) {
  api.commands.add({
    id: 'insert-greeting',
    label: 'Insert a greeting',
    handler: async () => {
      const values = await api.ui.prompt({
        title: 'Insert a greeting',
        fields: [{ name: 'name', label: 'Who is it for?', type: 'text', required: true }],
        confirmLabel: 'Insert',
      });
      if (!values) return;
      await api.editor.insertText(`Hello, ${values.name}!`);
    },
  });

  api.commands.add({
    id: 'count-words',
    label: 'Count words in this note',
    handler: async () => {
      const note = await api.editor.getActiveNote();
      if (!note) {
        await api.ui.toast('Open a note first', 'error');
        return;
      }
      const text = note.content.replace(/<[^>]+>/g, ' ');
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      await api.ui.toast(`${words} word${words === 1 ? '' : 's'}`, 'success');
    },
  });
}
```

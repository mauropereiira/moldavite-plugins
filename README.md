<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/banner-dark.png">
  <img src=".github/banner-light.png" alt="Moldavite — community plugins" width="100%">
</picture>

<p align="center">
  <em>Plugins for Moldavite, a privacy-first, local-first Markdown notes app for macOS, Windows and Linux.</em>
</p>

<p align="center">
  <a href="#what-this-is">What this is</a> ·
  <a href="#install-a-plugin">Install a plugin</a> ·
  <a href="#the-plugins">The plugins</a> ·
  <a href="#build-and-submit-a-plugin">Build and submit a plugin</a> ·
  <a href="#how-review-works">How review works</a> ·
  <a href="#security-model">Security model</a> ·
  <a href="#if-a-plugin-misbehaves">If a plugin misbehaves</a> ·
  <a href="#license">License</a>
</p>

---

## What this is

This repository is the Moldavite community plugin directory. `registry.json` lists every
plugin Moldavite can show you, each plugin's code lives under `plugins/<id>/`, and
`scripts/` holds the checks a plugin passes before it is listed. If you want to write a
plugin, see [Build and submit a plugin](#build-and-submit-a-plugin) below.

## Install a plugin

Moldavite never checks for plugins on its own, at startup or in the background. It fetches
`registry.json` from this repository's main branch only when you do one of these:

- **Settings → Plugins → Browse community plugins**, inside Moldavite.
- Click an **Install in Moldavite** link on the [website directory](https://moldavite.dev/plugins#directory), shaped `moldavite://plugin/<id>`.
- **Install from .zip…** or **Install from folder…**, for a plugin someone made or downloaded outside this directory. Moldavite has not reviewed this code: the confirmation warns you and shows the SHA-256 of `plugin.js`, so you can check it against what the author published.

Every route stops at a confirmation that names the plugin, what it can do, and every host it
can send data to. Installing a plugin never turns it on.

Approval is pinned to the SHA-256 of the exact `manifest.json` and `plugin.js` you approved.
If either file changes, Moldavite shows **Needs review** and the plugin stays off until you
approve it again. Updating a listed plugin shows which permissions and hosts are new and
which were dropped.

## The plugins

| Plugin | What it does | Permissions |
| --- | --- | --- |
| [Example Plugin](plugins/moldavite-example) | Insert a timestamp and show the current note's word count. | commands, editor, ui |
| [Publish to WordPress](plugins/moldavite-wordpress) | Publish the active note as a WordPress draft, with safe updates on re-publish. WordPress.com Simple sites require OAuth and are not supported. | commands, editor, ui, notes.read, net.fetch (public-api.wordpress.com), secrets |

This table mirrors `registry.json`. Each plugin's own README explains what it sends where in
more detail.

## Build and submit a plugin

- If you are a person, read [CONTRIBUTING.md](CONTRIBUTING.md) for the full walkthrough, from
  forking this repository to a merged listing.
- If you are an AI coding agent, read [AGENTS.md](AGENTS.md) for the exact rules and commands.
- Both point to the reference docs: [docs/plugin-format.md](docs/plugin-format.md) (the
  manifest and folder rules), [docs/api.md](docs/api.md) (the plugin API), and
  [docs/testing.md](docs/testing.md) (the checks you run before opening a pull request).

## How review works

Every listed plugin is reviewed and approved by the maintainer before it is listed. Two
automatic checks run on each pull request first:

- **Validate plugins** runs the pull request's own validator, a sandbox smoke test, and the
  tooling's own tests, with a read-only token and no secrets.
- **Registry check** runs the validator from `main` against the pull request's files as data,
  and runs nothing from the pull request itself, so a pull request cannot change the check it
  is judged by.

A green check never publishes anything. [`.github/CODEOWNERS`](.github/CODEOWNERS) routes
every file in this repository to the maintainer, and merging needs their approval. The checks
are a baseline: review of what the code actually does is the real gate. See
[docs/review-policy.md](docs/review-policy.md) for what is checked and what gets a listing
removed.

## Security model

- Every install route stops at a confirmation naming what the plugin can do and every host it
  can reach. Installing never turns a plugin on.
- Approval is pinned to the SHA-256 of the exact `manifest.json` and `plugin.js` you approved.
  Any change needs approval again.
- Rust verifies both registry hashes before an atomic install.
- Plugins run on macOS, Windows and Linux only. The iPhone and iPad app does not run plugins:
  it hides plugin settings and never runs plugin files that sync to it.

## If a plugin misbehaves

Moldavite can start without running any plugin:

1. Automatically: if the last start never finished loading plugins, the next launch starts
   without them.
2. Safe mode from the command line, which restarts Moldavite (or starts it) without plugins:
   - macOS: `open -n -a Moldavite --args --safe-mode`
   - Windows, in the Run box: `"%LOCALAPPDATA%\Moldavite\Moldavite.exe" --safe-mode`, or
     `"%ProgramFiles%\Moldavite\Moldavite.exe" --safe-mode` for `.msi` installs
   - Linux: `moldavite --safe-mode`, or `./Moldavite_<version>_amd64.AppImage --safe-mode`
3. Inside Moldavite: **Settings → Plugins → Stop all plugins**, or **Turn off plugin** in any
   dialog a plugin opens.
4. As a last resort, move the plugin's folder out of `<Forge>/.plugins/`.

Full details: [Moldavite's "If a plugin stops Moldavite from working"](https://github.com/mauropereiira/Moldavite/blob/main/docs/PLUGINS.md#if-a-plugin-stops-moldavite-from-working).

To report a problem:

- A security issue that others could exploit: report it privately. See [SECURITY.md](SECURITY.md).
- A listed plugin that is broken, misleading, or doing something it should not: open a
  [Report a plugin](https://github.com/mauropereiira/moldavite-plugins/issues/new?template=report-plugin.yml) issue.
- A problem with Moldavite itself, not a plugin: [Moldavite's issue tracker](https://github.com/mauropereiira/Moldavite/issues).

## License

This repository's tooling and docs are [MIT licensed](LICENSE). Each plugin is MIT licensed
by default; check its folder for a different OSI-approved license.

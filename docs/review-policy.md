# Review policy

Every listed plugin is reviewed and approved by the maintainer, [@mauropereiira](https://github.com/mauropereiira),
before it is listed. [`.github/CODEOWNERS`](../.github/CODEOWNERS) routes every file in this
repository to them, so nothing merges, and nothing reaches `registry.json` on `main`, without
their approval.

## What CI checks first

Two automatic checks run on every pull request, both with a read-only token and no secrets:

- **Validate plugins** runs the pull request's own validator, the sandbox smoke test, and the
  tooling's tests. See [docs/testing.md](testing.md) for what each of those does.
- **Registry check** runs the validator from `main` against the pull request's files as data,
  and runs nothing from the pull request itself, so a pull request cannot change the check it
  is judged by.

These checks are a baseline. A green check means the manifest is well-formed and the plugin
loads; it says nothing about whether the plugin should be trusted. That judgment is the
review.

## What the maintainer checks

Beyond what the validator already enforces:

- The permissions requested are the fewest the plugin needs to do what it says.
- `allowedHosts` lists exact hosts, and each one is explained: what is sent there, and why.
- The plugin loads no code from elsewhere: no dynamic `import`, no `eval`, no `new Function`.
- `plugin.js` is readable, unminified source, and the author can explain what it does.
- The plugin does not include analytics, tracking, ads, or telemetry.
- The README says what the plugin sends where and what it stores, and gives a command to
  delete anything it stores in `secrets`.
- Content is suitable for all ages.
- The pull request touches exactly one plugin, and does not edit another author's plugin.
- The plugin is MIT licensed, or carries its own OSI-approved license file in its folder.
- If an AI coding agent prepared the pull request, it says so, and a person reviewed the
  result before asking for review.

## What gets refused

A pull request is not merged, and a listing is not kept, if it asks for more than it needs, if
`plugin.js` is minified, obfuscated, or otherwise not something the author can explain line by
line, if it loads code from outside `plugin.js` itself, if it phones home for analytics or
tracking, if its README does not say what it sends and stores, if it bundles more than one
plugin, if it edits a plugin it does not own, or if its content is not suitable for all ages.

## How updates are reviewed

An update to a listed plugin goes through the same two checks and the same review as a new
one. The maintainer also checks:

- `version` in `manifest.json` went up. `scripts/validate.mjs` refuses a pull request that
  changes a plugin's files without raising its version.
- Any newly requested permission or host is explained in the pull request, because it is what
  installed users will see and have to approve again before the update takes effect.
- Any dropped permission or host is reflected in the README.

## Delisting

The maintainer can remove a listing that breaks these rules at any time. Removing a listing
only takes it out of `registry.json`: it does not reach anyone
who already installed the plugin. Moldavite never updates or turns on a plugin by itself, so
an installed copy keeps running exactly as it was until the person who installed it turns it
off or uninstalls it themselves.

## Reporting a problem

- A security issue that others could exploit: report it privately. See [SECURITY.md](../SECURITY.md).
- A listed plugin that is broken, misleading, or doing something it should not: open a
  [Report a plugin](https://github.com/mauropereiira/moldavite-plugins/issues/new?template=report-plugin.yml) issue.
- A problem with Moldavite itself, not a plugin: [Moldavite's issue tracker](https://github.com/mauropereiira/Moldavite/issues).

# Security policy

## Reporting a vulnerability

Report privately through [GitHub Security Advisories](https://github.com/mauropereiira/moldavite-plugins/security/advisories/new),
or email [support@moldavite.dev](mailto:support@moldavite.dev) if you cannot use GitHub.
Use this for anything that should not be discussed in public yet: a listed plugin doing
something malicious or deceptive, a way to get a plugin listed without real review, or a bug
in this repository's own checks that lets something unsafe through.

Do not open a public issue for a vulnerability. If a listed plugin is doing something wrong
but not something you would call a vulnerability (broken, misleading, or against the rules in
[docs/review-policy.md](docs/review-policy.md)), use the
[Report a plugin](https://github.com/mauropereiira/moldavite-plugins/issues/new?template=report-plugin.yml) issue template instead.

## Scope

This covers:

- Every plugin listed in `registry.json`.
- This repository's own tooling: the validator, the sandbox smoke test, the registry entry
  generator, and the GitHub Actions workflows that run them.

## What the maintainer can do

The maintainer can remove a plugin's listing at any time. Delisting only takes a plugin out of
`registry.json`:

- Anyone who already installed the plugin keeps their installed copy.
- Moldavite never updates or turns on a plugin by itself, so a delisted plugin does not change
  behavior on its own for someone who already has it installed. They uninstall it themselves,
  from **Settings → Plugins**.

## Moldavite app vulnerabilities

A vulnerability in Moldavite itself, not in a plugin or in this repository, is not in scope
here. Report it against the app: [https://github.com/mauropereiira/Moldavite/issues](https://github.com/mauropereiira/Moldavite/issues).

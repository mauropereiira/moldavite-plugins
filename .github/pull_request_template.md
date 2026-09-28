<!-- Thanks for sending a plugin. Everything here is reviewed by a person before it is listed. -->

## What it does

<!-- One or two sentences a Moldavite user would understand. -->

## What it can reach

<!-- Each permission and why the plugin needs it. For net.fetch, each host, what is sent there, and why. For secrets, each key it stores. -->

## Checklist

- [ ] One plugin per pull request, in `plugins/<id>/` with `manifest.json`, `plugin.js` and `README.md`
- [ ] `npm run check` and `npm test` pass locally
- [ ] `registry.json` was updated with `npm run registry -- <id>`
- [ ] For an update, `version` went up in `manifest.json` (and so in `registry.json`)
- [ ] I tried it in Moldavite with **Settings → Plugins → Install from folder…**
- [ ] `plugin.js` is readable source I wrote or can explain, not minified, with no code loaded from elsewhere
- [ ] The README says what the plugin sends where, and how to remove anything it stores
- [ ] I can license this under the MIT license (or the license in the plugin folder)

<!-- If an AI coding agent prepared this pull request, say which one and that you reviewed its work. -->

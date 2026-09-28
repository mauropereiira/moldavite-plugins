# Plugin API

This mirrors the plugin API section of Moldavite's own
[author guide](https://github.com/mauropereiira/Moldavite/blob/main/docs/PLUGINS.md). If the
two ever disagree, the app's guide wins: it ships with the app, and this page is a copy kept in
sync by hand.

## Entry point

`plugin.js` is an ES module with a default `register(api)` export, called once when the plugin
loads:

```js
export default function register(api) {
  api.commands.add({
    id: 'inspect-active-note',
    label: 'Inspect active note',
    handler: async () => {
      const note = await api.editor.getActiveNote();
      if (!note) return;
      await api.ui.toast(`Open: ${note.path}`, 'success');
    },
  });
}
```

Register commands during startup; handlers may be synchronous or asynchronous. Every method
except `commands.add` is an asynchronous host call, and a command invocation that never
settles is rejected after 30 seconds.

## Complete API v2 surface

```ts
interface PluginAPI {
  app: { version: string; apiVersion: 2 };

  // Requires "commands".
  commands: {
    add(command: { id: string; label: string; handler: () => void | Promise<void> }): void;
  };

  // Requires "editor". Content is live editor HTML.
  editor: {
    getActiveNote(): Promise<{
      path: string;
      title: string;
      content: string;
    } | null>;
    insertText(text: string): Promise<void>;
  };

  ui: {
    // Requires "ui".
    toast(message: string, kind?: 'info' | 'success' | 'error'): Promise<void>;

    // Requires "ui". API v2 only.
    prompt(options: {
      title: string;
      message?: string;
      fields: Array<{
        name: string;
        label: string;
        type: 'text' | 'password' | 'url';
        placeholder?: string;
        required?: boolean;
      }>;
      confirmLabel?: string;
    }): Promise<Record<string, string> | null>;
  };

  // Requires "notes.read". Content is Markdown, not editor HTML.
  notes: {
    list(): Promise<
      Array<{
        path: string;
        title: string;
        kind: 'daily' | 'weekly' | 'standalone';
        folder: string | null;
      }>
    >;
    read(path: string): Promise<string>;
  };

  // Requires "net.fetch".
  net: {
    requestHostAccess(host: string): Promise<boolean>;
    fetch(
      url: string,
      options?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      }
    ): Promise<{
      status: number;
      headers: Record<string, string>;
      bodyText: string;
      bodyBase64?: string;
    }>;
  };

  // Requires "secrets".
  secrets: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
  };
}
```

### App metadata and commands

#### `api.app.version: string`

The running Moldavite app version.

#### `api.app.apiVersion: 1 | 2`

The API version selected by this manifest.

#### `api.commands.add(command): void`

Requires `commands`. Adds a command to the command palette and editor slash menu. Expects
string `id` and `label` fields and a function `handler`. Registering the same id again
replaces that handler, so use unique ids.

### Editor

Requires `editor`.

#### `editor.getActiveNote(): Promise<{ path, title, content } | null>`

Returns the active note's Forge-relative `path`, display `title`, and live editor HTML in
`content`, or `null` when no note is open.

#### `editor.insertText(text: string): Promise<void>`

Inserts text at the active editor cursor. If there is no active editor, or the open note is
read only (a locked note opened to view), nothing is inserted and Moldavite shows an error
notification instead.

Use `path`, not the display title, as the key for any per-note plugin state.

### User interface

#### `ui.toast(message, kind?): Promise<void>`

Requires `ui`. `kind` is `info`, `success`, or `error`, and defaults to `info`.

#### `ui.prompt(options): Promise<Record<string, string> | null>`

Requires `ui` and API v2. Every prompt is a Moldavite-rendered form, shown in trusted chrome
above anything the plugin supplies, with its own **Turn off plugin** button. Submit returns a
string map keyed by field name. Cancel, Escape, or turning the plugin off from the dialog all
return `null`. Moldavite allows one plugin prompt or host-consent dialog at a time.

Prompt limits:

| Value | Limit |
| --- | --- |
| `title` | 1 to 200 characters |
| `message` | Optional, up to 2,000 characters |
| `fields` | 1 to 12 entries |
| field `name` | Starts with a letter; letters, digits, `_`, `-`; up to 64 characters |
| field `label` | 1 to 160 characters |
| field `type` | `text`, `password`, or `url` |
| field `placeholder` | Optional, up to 300 characters |
| `confirmLabel` | Optional, 1 to 80 characters |

### Notes

Requires `notes.read`.

#### `notes.list(): Promise<PluginNoteMetadata[]>`

Returns metadata for daily, weekly, and standalone notes, including locked placeholders so the
listing stays complete.

#### `notes.read(path: string): Promise<string>`

Reads the parsed Markdown body for an exact path in the current Forge. Unknown paths and
locked notes reject. YAML frontmatter is not included. Paths look like
`daily/2026-07-13.md`, `weekly/2026-W29.md`, or `notes/Projects/roadmap.md`.

### Network

Requires `net.fetch` and a non-empty manifest `allowedHosts` array.

#### `net.requestHostAccess(host: string): Promise<boolean>`

Returns `true` when an exact host is already approved by the manifest or an earlier runtime
grant. Otherwise it opens a Moldavite-rendered consent dialog naming the plugin and host.
Denial returns `false` without throwing; an invalid hostname rejects. A granted runtime host
survives a plugin update, stays individually visible and revocable in
**Settings → Plugins → View permissions**, and is forgotten when the plugin is uninstalled.

#### `net.fetch(url, options?): Promise<{ status, headers, bodyText, bodyBase64? }>`

Asks Moldavite to make a request after checking the effective host allowlist (manifest hosts
plus any approved at runtime). Only absolute HTTPS URLs with no embedded credentials are
accepted. Headers must be a string map, and the body must be a string.

Fetch and redirect rules:

- Request methods are letters only; `CONNECT`, `TRACE`, and `TRACK` are blocked.
- Redirects are followed manually, up to five hops, with each `Location` validated before the
  next request. A redirect with no `Location` header is rejected.
- A cross-origin redirect keeps only `Accept`, `Accept-Language`, and, when a body remains,
  `Content-Type`. `Authorization` and cookies are not forwarded.
- The whole chain has a 30-second timeout, and the response is capped at 10 MiB.
- Response headers are limited to `content-type`, `content-length`, `etag`, `last-modified`,
  `link`, `retry-after`, `x-wp-total`, and `x-wp-totalpages`. `set-cookie` is never exposed.
- Text, JSON, XML, JavaScript, and form bodies decode into `bodyText`; other responses also
  include `bodyBase64`.

### Secrets

Requires `secrets`.

#### `secrets.get(key): Promise<string | null>`

Returns the stored string, or `null` when there is no entry.

#### `secrets.set(key, value): Promise<void>`

Stores a string in this plugin's namespace of the OS credential store (macOS Keychain, Windows
Credential Manager, Linux Secret Service).

#### `secrets.delete(key): Promise<void>`

Deletes an entry when present, and otherwise succeeds.

Key rule: 1 to 128 characters, starting with a letter or digit, then letters, digits, `.`,
`_`, or `-`. Secret values are never included in Forge, settings, plugin, ZIP, or
encrypted-backup exports, and uninstalling a plugin does not delete its stored secrets, because
plugin keys are not enumerable. If your plugin stores secrets, give it a command that deletes
them, and say so in its README.

## Permissions

| Permission | Grants |
| --- | --- |
| none | `app` only |
| `commands` | Register commands in the command palette and editor slash menu |
| `editor` | Read the active note's path, title, and HTML, and insert text at the cursor |
| `ui` | Show toasts and, on API v2, host-rendered prompts |
| `notes.read` | List note metadata and read unlocked Markdown bodies |
| `net.fetch` | Request runtime hosts and call exact approved HTTPS hosts |
| `secrets` | Read, write, and delete this plugin's namespaced credential-store entries |

## API v1 compatibility

A manifest with `"apiVersion": 1` gets the original `app`, `commands`, `editor`, and
`ui.toast` surface only, with `api.app.apiVersion === 1`. It does not need a manifest or
source migration. Use API v2 (`"apiVersion": 2`) for `ui.prompt`, `notes`, `net`, or `secrets`.

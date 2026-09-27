// The rules a plugin must meet to be listed. The manifest rules mirror the
// Moldavite app's validator (src/lib/plugins/manifest.ts), which is what users
// run; the registry rules mirror its registry parser (src/lib/plugins/registry.ts).
// A change to either in the app belongs here in the same release.

export const SUPPORTED_API_VERSIONS = [1, 2];
export const PERMISSIONS = ['commands', 'editor', 'ui', 'notes.read', 'net.fetch', 'secrets'];
/** API v1 plugins receive only this surface; asking for more is a mistake. */
export const API_V1_PERMISSIONS = ['commands', 'editor', 'ui'];

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

const MANIFEST_FIELDS = [
  'id',
  'name',
  'version',
  'apiVersion',
  'author',
  'description',
  'minAppVersion',
  'permissions',
  'allowedHosts',
  'commands',
  'instructions',
];
const TEXT_LIMITS = { name: 160, version: 64, author: 160, description: 1000, minAppVersion: 64 };
const MAX_PERMISSIONS = 50;
const MAX_COMMANDS = 50;
const MAX_COMMAND_ID = 128;
const MAX_COMMAND_LABEL = 200;
const MAX_INSTRUCTIONS = 20;
const MAX_INSTRUCTION_LENGTH = 500;
const MAX_HOSTS = 50;

export const REGISTRY_FIELDS = [
  'id',
  'name',
  'version',
  'description',
  'author',
  'apiVersion',
  'minAppVersion',
  'permissions',
  'allowedHosts',
  'files',
  'path',
];
export const MAX_REGISTRY_PLUGINS = 500;

export function isPluginId(id) {
  return typeof id === 'string' && id.length <= 64 && ID_RE.test(id);
}

export function isSha256(value) {
  return typeof value === 'string' && SHA256_RE.test(value);
}

export function parseSemver(value) {
  const match = typeof value === 'string' ? SEMVER_RE.exec(value) : null;
  if (!match) return null;
  return { parts: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] ?? null };
}

/** Negative when a < b, zero when equal, positive when a > b. Both must parse. */
export function compareSemver(a, b) {
  const x = parseSemver(a);
  const y = parseSemver(b);
  if (!x || !y) throw new Error(`not a semantic version: ${!x ? a : b}`);
  for (let i = 0; i < 3; i += 1) {
    if (x.parts[i] !== y.parts[i]) return x.parts[i] - y.parts[i];
  }
  if (x.pre === y.pre) return 0;
  if (x.pre === null) return 1;
  if (y.pre === null) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/** Exact lowercase public DNS name: no scheme, port, path, IP, wildcard, or localhost. */
export function isAllowedHost(host) {
  if (
    typeof host !== 'string' ||
    host.length > 253 ||
    host !== host.toLowerCase() ||
    /[*:[\]]/.test(host)
  ) {
    return false;
  }
  const labels = host.split('.');
  if (labels.length < 2 || labels.every((label) => /^\d+$/.test(label))) return false;
  if (labels.includes('localhost')) return false;
  return labels.every(
    (label) =>
      label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  );
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Every problem with a manifest, as plain sentences. Empty means it is valid. */
export function manifestProblems(manifest, folderId) {
  const problems = [];
  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) {
    return ['manifest.json must be a JSON object'];
  }
  for (const key of Object.keys(manifest)) {
    if (!MANIFEST_FIELDS.includes(key)) problems.push(`unknown manifest field "${key}"`);
  }
  const { id, name, version, apiVersion } = manifest;
  if (typeof id !== 'string' || typeof name !== 'string' || typeof version !== 'string') {
    problems.push('id, name and version are required strings');
  }
  if (typeof apiVersion !== 'number') problems.push('apiVersion is required and must be a number');
  if (typeof id === 'string' && !isPluginId(id)) {
    problems.push(`id "${id}" must be lowercase letters, digits and hyphens, up to 64 characters`);
  }
  if (typeof id === 'string' && folderId !== undefined && id !== folderId) {
    problems.push(`id "${id}" must match its folder name "${folderId}"`);
  }
  if (typeof name === 'string' && name.trim().length === 0) problems.push('name must not be empty');
  for (const field of ['author', 'description', 'minAppVersion']) {
    if (manifest[field] !== undefined && typeof manifest[field] !== 'string') {
      problems.push(`${field} must be a string`);
    }
  }
  for (const [field, max] of Object.entries(TEXT_LIMITS)) {
    if (typeof manifest[field] === 'string' && manifest[field].length > max) {
      problems.push(`${field} must be at most ${max} characters`);
    }
  }
  if (typeof version === 'string' && !parseSemver(version)) {
    problems.push(`version "${version}" must be a semantic version such as 1.0.0`);
  }
  if (manifest.minAppVersion !== undefined && !parseSemver(manifest.minAppVersion)) {
    problems.push(`minAppVersion "${manifest.minAppVersion}" must be a version such as 2.10.0`);
  }
  if (typeof apiVersion === 'number' && !SUPPORTED_API_VERSIONS.includes(apiVersion)) {
    problems.push(`apiVersion ${apiVersion} is not supported (use ${SUPPORTED_API_VERSIONS.join(' or ')})`);
  }

  const { permissions, allowedHosts, instructions, commands } = manifest;
  if (permissions !== undefined) {
    if (!isStringArray(permissions)) {
      problems.push('permissions must be an array of strings');
    } else {
      if (permissions.length > MAX_PERMISSIONS) problems.push('permissions has too many entries');
      if (new Set(permissions).size !== permissions.length) problems.push('permissions has duplicates');
      for (const permission of permissions) {
        if (!PERMISSIONS.includes(permission)) {
          problems.push(`unknown permission "${permission}" (supported: ${PERMISSIONS.join(', ')})`);
        } else if (apiVersion === 1 && !API_V1_PERMISSIONS.includes(permission)) {
          problems.push(`"${permission}" needs apiVersion 2`);
        }
      }
    }
  }
  if (allowedHosts !== undefined) {
    if (!isStringArray(allowedHosts)) {
      problems.push('allowedHosts must be an array of hostnames');
    } else {
      if (allowedHosts.length > MAX_HOSTS) problems.push('allowedHosts has too many entries');
      if (new Set(allowedHosts).size !== allowedHosts.length) problems.push('allowedHosts has duplicates');
      for (const host of allowedHosts) {
        if (!isAllowedHost(host)) {
          problems.push(
            `allowedHosts entry "${host}" must be an exact lowercase hostname, with no scheme, port, path, IP address, wildcard or localhost`
          );
        }
      }
    }
  }
  const fetches = isStringArray(permissions) && permissions.includes('net.fetch');
  if (fetches && !(isStringArray(allowedHosts) && allowedHosts.length > 0)) {
    problems.push('net.fetch needs at least one allowedHosts entry');
  }
  if (!fetches && isStringArray(allowedHosts) && allowedHosts.length > 0) {
    problems.push('allowedHosts is only used with the net.fetch permission');
  }
  if (instructions !== undefined) {
    if (!isStringArray(instructions)) {
      problems.push('instructions must be an array of strings');
    } else {
      if (instructions.length > MAX_INSTRUCTIONS) problems.push(`instructions has more than ${MAX_INSTRUCTIONS} steps`);
      if (instructions.some((step) => step.length > MAX_INSTRUCTION_LENGTH)) {
        problems.push(`each instructions step must be at most ${MAX_INSTRUCTION_LENGTH} characters`);
      }
    }
  }
  if (commands !== undefined) {
    if (!Array.isArray(commands)) {
      problems.push('commands must be an array');
    } else {
      if (commands.length > MAX_COMMANDS) problems.push(`commands has more than ${MAX_COMMANDS} entries`);
      const ids = [];
      for (const command of commands) {
        const shaped =
          typeof command === 'object' &&
          command !== null &&
          !Array.isArray(command) &&
          Object.keys(command).every((key) => key === 'id' || key === 'label') &&
          typeof command.id === 'string' &&
          typeof command.label === 'string' &&
          command.id.length > 0 &&
          command.id.length <= MAX_COMMAND_ID &&
          command.label.length > 0 &&
          command.label.length <= MAX_COMMAND_LABEL;
        if (!shaped) {
          problems.push('each command must be { "id", "label" } with non-empty, bounded strings');
          continue;
        }
        ids.push(command.id);
      }
      if (new Set(ids).size !== ids.length) problems.push('command ids must be unique');
      if (commands.length > 0 && !(isStringArray(permissions) && permissions.includes('commands'))) {
        problems.push('declaring commands needs the "commands" permission');
      }
    }
  }
  return problems;
}

/** Problems with one registry entry on its own, before it is compared with its files. */
export function registryEntryProblems(entry) {
  const problems = [];
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    return ['each registry entry must be an object'];
  }
  for (const key of Object.keys(entry)) {
    if (!REGISTRY_FIELDS.includes(key)) problems.push(`unknown registry field "${key}"`);
  }
  if (!isPluginId(entry.id)) problems.push('id must be a valid plugin id');
  for (const [field, max] of [
    ['name', 160],
    ['version', 64],
    ['description', 1000],
    ['author', 160],
  ]) {
    const value = entry[field];
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
      problems.push(`${field} is required, non-empty and at most ${max} characters`);
    }
  }
  if (!SUPPORTED_API_VERSIONS.includes(entry.apiVersion)) {
    problems.push(`apiVersion must be ${SUPPORTED_API_VERSIONS.join(' or ')}`);
  }
  for (const field of ['permissions', 'allowedHosts']) {
    if (!isStringArray(entry[field])) problems.push(`${field} must be an array of strings`);
  }
  const files = entry.files;
  const fileNames = files && typeof files === 'object' ? Object.keys(files).sort() : [];
  if (fileNames.join() !== 'manifest.json,plugin.js') {
    problems.push('files must list exactly manifest.json and plugin.js');
  } else {
    for (const name of fileNames) {
      const file = files[name];
      if (!file || Object.keys(file).join() !== 'sha256' || !isSha256(file.sha256)) {
        problems.push(`files["${name}"] must be { "sha256": <64 lowercase hex characters> }`);
      }
    }
  }
  if (isPluginId(entry.id) && entry.path !== `plugins/${entry.id}`) {
    problems.push(`path must be "plugins/${entry.id}"`);
  }
  return problems;
}

/** Fields the app shows from the registry must say exactly what the manifest says. */
export function mirrorProblems(entry, manifest) {
  const problems = [];
  const expected = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    apiVersion: manifest.apiVersion,
    minAppVersion: manifest.minAppVersion,
    permissions: manifest.permissions ?? [],
    allowedHosts: manifest.allowedHosts ?? [],
  };
  for (const [field, value] of Object.entries(expected)) {
    if (JSON.stringify(entry[field]) !== JSON.stringify(value)) {
      problems.push(
        `registry ${field} ${JSON.stringify(entry[field])} does not match manifest.json ${JSON.stringify(value)}`
      );
    }
  }
  if (typeof manifest.description !== 'string' || typeof manifest.author !== 'string') {
    problems.push('listed plugins need a description and an author in manifest.json');
  }
  return problems;
}

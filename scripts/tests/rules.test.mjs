import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareSemver, isAllowedHost, manifestProblems } from '../lib/rules.mjs';
import { manifest } from './helpers.mjs';

test('a complete manifest has no problems', () => {
  assert.deepEqual(manifestProblems(manifest(), 'hello-world'), []);
});

test('manifest rules match what the app enforces', () => {
  const cases = [
    [{ extra: 1 }, 'unknown manifest field "extra"'],
    [{ id: 'Hello' }, 'must be lowercase'],
    [{ apiVersion: 3 }, 'apiVersion 3 is not supported'],
    [{ permissions: ['fs'] }, 'unknown permission "fs"'],
    [{ permissions: ['commands', 'net.fetch'] }, 'net.fetch needs at least one allowedHosts entry'],
    [{ permissions: ['commands', 'net.fetch'], allowedHosts: ['https://api.example.com'] }, 'exact lowercase hostname'],
    [{ permissions: ['commands', 'net.fetch'], allowedHosts: ['*.example.com'] }, 'exact lowercase hostname'],
    [{ commands: [{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }] }, 'command ids must be unique'],
    [{ description: 'x'.repeat(1001) }, 'description must be at most 1000 characters'],
    [{ instructions: Array(21).fill('step') }, 'more than 20 steps'],
  ];
  for (const [overrides, expected] of cases) {
    const problems = manifestProblems(manifest(overrides), 'hello-world');
    assert.ok(problems.some((p) => p.includes(expected)), `${JSON.stringify(overrides)} -> ${problems}`);
  }
  assert.ok(manifestProblems(manifest(), 'other-folder').some((p) => p.includes('must match its folder')));
});

test('the directory is stricter than the app where the app would only fail later', () => {
  const noCommandsPermission = manifestProblems(manifest({ permissions: ['ui'] }), 'hello-world');
  assert.ok(noCommandsPermission.includes('declaring commands needs the "commands" permission'));
  const v1Network = manifestProblems(manifest({ apiVersion: 1, permissions: ['commands', 'notes.read'] }), 'hello-world');
  assert.ok(v1Network.includes('"notes.read" needs apiVersion 2'));
  assert.ok(manifestProblems(manifest({ version: '1.0' }), 'hello-world').some((p) => p.includes('semantic version')));
  assert.ok(manifestProblems(manifest({ allowedHosts: ['api.example.com'] }), 'hello-world').some((p) => p.includes('only used with the net.fetch')));
});

test('hosts must be exact public DNS names', () => {
  for (const good of ['api.example.com', 'public-api.wordpress.com', 'a-b.c9.io']) assert.ok(isAllowedHost(good), good);
  for (const bad of ['localhost', 'api.localhost', '127.0.0.1', 'example', 'Api.example.com', 'api.example.com:443', '[::1]', '-a.example.com', 'a..b.com']) {
    assert.ok(!isAllowedHost(bad), bad);
  }
});

test('semantic versions compare numerically and rank prereleases lower', () => {
  assert.ok(compareSemver('1.10.0', '1.9.9') > 0);
  assert.ok(compareSemver('2.0.0-beta.1', '2.0.0') < 0);
  assert.equal(compareSemver('1.0.0+build', '1.0.0'), 0);
});

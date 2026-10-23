import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRelease } from './validate-release.mjs';

test('release refuses missing app, missing lock and missing test/build scripts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pulse-release-'));
  try {
    await assert.rejects(validateRelease(root), /package.json/);
    await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { test: 'test', build: 'build' } }));
    await assert.rejects(validateRelease(root), /package-lock.json/);
    await writeFile(join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { '': {} } }));
    await assert.doesNotReject(validateRelease(root));
    await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { build: 'build' } }));
    await assert.rejects(validateRelease(root), /test and build/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

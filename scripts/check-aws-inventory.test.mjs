// node --test scripts/check-aws-inventory.test.mjs
// quality/check_aws_inventory.mjs: skips (exit 0) only when the AWS CLI is missing; a CLI that fails exits 2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECK = join(dirname(fileURLToPath(import.meta.url)), '../quality/check_aws_inventory.mjs');
// node is started by absolute path, so PATH holds only the directory under test.
const run = (binDir) => spawnSync(process.execPath, [CHECK], { encoding: 'utf8', env: { PATH: binDir, HOME: tmpdir() } });

test('skips with exit 0 when the AWS CLI is not installed', () => {
  const r = run(mkdtempSync(join(tmpdir(), 'noaws-')));
  assert.equal(r.status, 0);
  assert.match(r.stderr, /skipped, AWS CLI not installed/);
});

test('exits 2 when the AWS CLI is installed but fails', () => {
  const bin = mkdtempSync(join(tmpdir(), 'failaws-'));
  writeFileSync(join(bin, 'aws'), '#!/bin/sh\necho "Unable to locate credentials" >&2\nexit 255\n');
  chmodSync(join(bin, 'aws'), 0o755);
  const r = run(bin);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /AWS call failed/);
});

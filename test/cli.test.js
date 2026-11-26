import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
test('CLI supports JSON and CSV output, refuses overwrite and protects input', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'yqspay-split-test-'));
  try {
    const run = args => spawnSync(process.execPath, ['bin/split.mjs', '--input', 'examples/platform.json', ...args], { cwd: root, encoding: 'utf8' });
    const out = join(dir, 'result.json'); assert.equal(run(['--out', out]).status, 0);
    assert.equal(JSON.parse(await readFile(out, 'utf8')).feeCents, 380);
    assert.notEqual(run(['--out', out]).status, 0);
    assert.notEqual(run(['--out', 'examples/platform.json']).status, 0);
    const csv = run(['--csv']); assert.equal(csv.status, 0); assert.match(csv.stdout, /预计净额/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

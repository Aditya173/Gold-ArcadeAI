// U1: reference() uploads real bytes (createUpload -> PUT uploadUrl -> create) through the local mock Arcade,
// sends an explicit User-Agent, and takes maxPolls from ARCADE_MAX_POLLS. Offline: mock_arcade.py --serve.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const arcade = require('../src/arcade');

const REPO = path.resolve(__dirname, '..', '..', '..');
const PY = process.env.PYTHON || 'python';

async function startMock(t) {
  const port = 19000 + Math.floor(Math.random() * 1000);
  const srv = spawn(PY, ['-u', path.join(REPO, 'arcade', 'mock_arcade.py'), '--serve', String(port)]);
  t.after(() => srv.kill());
  await new Promise((r) => { srv.stdout.on('data', r); srv.on('exit', r); setTimeout(r, 5000); });
  assert.strictEqual(srv.exitCode, null, `mock Arcade did not start (${PY})`);
  return `http://127.0.0.1:${port}/v1`;
}

test('reference(): one PNG -> createUpload -> PUT (no Authorization) -> create -> referenceId; same bytes replay', async (t) => {
  const base = await startMock(t);
  const sent = [];
  const fetchImpl = (url, init) => { sent.push({ url, ...init }); return fetch(url, init); };
  const a = arcade.client({ base, key: 'arcade_sk_live_MOCK', pollMs: 0, fetchImpl });
  const png = fs.readFileSync(path.join(REPO, 'marketplace', 'fixtures', 'images', 'logo.png'));
  const ref = await a.reference('image/png', png, 'u1-logo');
  assert.match(ref, /^ref-/);
  const put = sent.find((s) => s.method === 'PUT');
  assert.ok(put && put.url.includes('/mock/upload/'), 'bytes were PUT to the uploadUrl');
  assert.deepStrictEqual(put.headers, { 'Content-Type': 'image/png' }, 'exactly requiredHeaders: no Authorization');
  assert.strictEqual(put.body.length, png.length);
  assert.ok(sent.filter((s) => s.method === 'POST').every((s) => s.headers['User-Agent'] === 'gold-arcade-app/0.1'));
  assert.strictEqual(await a.reference('image/png', png, 'u1-logo'), ref, 'same requestId -> same referenceId');
  // a PUT the mock refuses (wrong length) surfaces as an ArcadeError
  const bad = arcade.client({ base, key: 'arcade_sk_live_MOCK', pollMs: 0,
    fetchImpl: (url, init) => fetch(url, init.method === 'PUT' ? { ...init, body: Buffer.from('x') } : init) });
  await assert.rejects(bad.reference('image/png', png, 'u1-bad'), (e) => e instanceof arcade.ArcadeError && e.status === 400);
});

test('maxPolls comes from ARCADE_MAX_POLLS (default 80)', async () => {
  let polls = 0;
  const fetchImpl = async () => { polls++; return { ok: true, status: 200, json: async () => ({ status: 'running' }) }; };
  const prev = process.env.ARCADE_MAX_POLLS;
  process.env.ARCADE_MAX_POLLS = '3';
  try {
    await assert.rejects(arcade.client({ base: 'http://127.0.0.1:1/v1', key: 'k', pollMs: 0, fetchImpl }).wait('j'), /after 3 polls/);
    assert.strictEqual(polls, 3);
    delete process.env.ARCADE_MAX_POLLS;
    polls = 0;
    await assert.rejects(arcade.client({ base: 'http://127.0.0.1:1/v1', key: 'k', pollMs: 0, fetchImpl }).wait('j'), /after 80 polls/);
  } finally { if (prev === undefined) delete process.env.ARCADE_MAX_POLLS; else process.env.ARCADE_MAX_POLLS = prev; }
});

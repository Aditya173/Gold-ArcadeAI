// POST /instagram/scrape, offline: INSTAGRAM_SCRAPE_FAKE=1 makes instagram/scrape.py serve generated images.
// Needs the PYTHON interpreter to have pillow. INSTAGRAM_SCRAPE_LIVE=1 adds one real logged-out fetch.
const test = require('node:test');
const assert = require('node:assert');
const ig = require('../src/instagram');

test('scrape (fake): newest first, pinned dropped, shrunk JPEGs as base64', async () => {
  process.env.INSTAGRAM_SCRAPE_FAKE = '1';
  const r = await ig.scrape('u1', { handle: '@wishbonekitchen', max: 6 });
  assert.strictEqual(r.handle, 'wishbonekitchen');
  assert.strictEqual(r.source, 'fake');
  assert.strictEqual(r.images.length, 4, 'the pinned post is dropped');
  assert.ok(r.images[0].takenAt.startsWith('2026-10-08'), 'newest first');
  for (const i of r.images) {
    const bytes = Buffer.from(i.dataBase64, 'base64');
    assert.strictEqual(bytes.length, i.byteLength);
    assert.ok(i.byteLength <= 1000000 && Math.max(i.width, i.height) <= 1600);
    assert.deepStrictEqual([...bytes.subarray(0, 2)], [0xff, 0xd8], 'a JPEG');
    assert.strictEqual(i.mediaType, 'image/jpeg');
  }
  assert.strictEqual((await ig.scrape('u1', { handle: 'wishbonekitchen', max: 2 })).images.length, 2);
});

test('scrape: bad handles are refused before anything runs', async () => {
  for (const handle of ['', 'a b', '--range', '../x', 'x'.repeat(31), 'a;rm -rf']) {
    await assert.rejects(ig.scrape('u1', { handle }), (e) => e.code === 'invalid-argument', handle);
  }
});

test('scrape (live, opt-in): one real logged-out fetch', { skip: process.env.INSTAGRAM_SCRAPE_LIVE !== '1' }, async () => {
  delete process.env.INSTAGRAM_SCRAPE_FAKE;
  const r = await ig.scrape('u1', { handle: process.env.INSTAGRAM_SCRAPE_HANDLE || 'wishbonekitchen', max: 3 });
  assert.strictEqual(r.source, 'gallery-dl');
  assert.ok(r.images.length >= 1);
});

// ---- Connect Instagram (Meta API), INSTAGRAM_FAKE=1: no Meta account, no network ----
// db: just enough of Firestore (db.doc(path).get/set) to see every write.
function memDb() {
  const docs = new Map();
  return { docs, doc: (p) => ({ get: async () => ({ exists: docs.has(p), data: () => docs.get(p) }), set: async (d) => { docs.set(p, d); } }) };
}
async function connected(uid = 'u1') {
  process.env.INSTAGRAM_FAKE = '1';
  const db = memDb();
  const { authUrl } = await ig.connect(db, uid);
  const qs = Object.fromEntries(new URL(authUrl, 'http://x').searchParams);
  return { db, qs, res: await ig.callback(db, qs) };
}

test('meta (fake): connect -> callback stores the token server-only, status says connected', async () => {
  process.env.INSTAGRAM_FAKE = '1';
  const db = memDb();
  assert.deepStrictEqual(await ig.status(db, 'u1'), { connected: false, username: null });
  await assert.rejects(ig.media(db, 'u1'), (e) => e.code === 'failed-precondition');
  const { db: db2, qs, res } = await connected('u1');
  assert.strictEqual(res.connected, true);
  assert.deepStrictEqual([...db2.docs.keys()], ['users/u1/private/instagram'], 'the token is written only to the private doc');
  assert.ok(db2.docs.get('users/u1/private/instagram').accessToken);
  assert.ok(!JSON.stringify(res).includes('fake-token'), 'the token never goes back to the client');
  assert.deepStrictEqual(await ig.status(db2, 'u1'), { connected: true, username: res.username });
  // the state is signed: another uid or a tampered one is refused
  for (const state of ['', qs.state.replace(/^u1/, 'u2'), qs.state.slice(0, -1) + (qs.state.endsWith('0') ? '1' : '0')]) {
    await assert.rejects(ig.callback(memDb(), { ...qs, state }), (e) => e.code === 'permission-denied', state);
  }
});

test('meta (fake): media is images only, the carousel flattened', async () => {
  const { db } = await connected();
  const { media } = await ig.media(db, 'u1');
  assert.deepStrictEqual(media.map((m) => m.id), ['fake-1', 'fake-c1', 'fake-c2', 'fake-4']);
  assert.ok(media.every((m) => m.mediaType === 'IMAGE' && m.mediaUrl && m.permalink && m.timestamp));
  assert.strictEqual((await ig.media(db, 'u1', { limit: 2 })).media.length, 2);
});

test('meta (fake): fetchForOnboard returns instagram images as bytes; a foreign ID is a 400', async () => {
  const { db } = await connected();
  const imgs = await ig.fetchForOnboard(db, 'u1', ['fake-1', 'fake-c2']);
  assert.deepStrictEqual(imgs.map((i) => [i.kind, i.mediaId, i.mediaType]), [['instagram', 'fake-1', 'image/png'], ['instagram', 'fake-c2', 'image/png']]);
  for (const i of imgs) assert.deepStrictEqual([...Buffer.from(i.dataBase64, 'base64').subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], 'a PNG');
  assert.deepStrictEqual(await ig.fetchForOnboard(db, 'u1', []), []);
  for (const ids of [['someone-elses-post'], ['fake-v'], ['fake-c'], ['1', '2', '3', '4', '5']]) {
    await assert.rejects(ig.fetchForOnboard(db, 'u1', ids), (e) => e.code === 'invalid-argument', ids.join());
  }
  await assert.rejects(ig.fetchForOnboard(memDb(), 'u1', ['fake-1']), (e) => e.code === 'failed-precondition', 'not connected');
});

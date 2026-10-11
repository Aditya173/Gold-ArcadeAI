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

// U4: POST /creators/onboard (style.onboard) through the local mock Arcade, on a tiny in-memory Firestore
// (only doc get/set/merge and subcollections: what style.js and flow insights use). Offline.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const arcade = require('../src/arcade');
const style = require('../src/style');
const flow = require('../src/flow');
const M = require('../src/marketplace');
const packs = require('../src/packs');

const REPO = path.resolve(__dirname, '..', '..', '..');
const PY = process.env.PYTHON || 'python';
const IMG = (n) => fs.readFileSync(path.join(REPO, 'marketplace', 'fixtures', 'images', n));

function memDb() {
  const store = new Map();
  const ref = (p) => ({
    path: p,
    collection: (c) => ({ doc: (id) => ref(`${p}/${c}/${id}`) }),
    get: async () => ({ exists: store.has(p), data: () => (store.has(p) ? JSON.parse(JSON.stringify(store.get(p))) : undefined) }),
    set: async (d, o = {}) => { store.set(p, o.merge ? { ...(store.get(p) || {}), ...d } : { ...d }); },
  });
  return { store, collection: (c) => ({ doc: (id) => ref(`${c}/${id}`) }) };
}

async function startMock(t) {
  const port = 20000 + Math.floor(Math.random() * 1000);
  const srv = spawn(PY, ['-u', path.join(REPO, 'arcade', 'mock_arcade.py'), '--serve', String(port)]);
  t.after(() => srv.kill());
  await new Promise((r) => { srv.stdout.on('data', r); srv.on('exit', r); setTimeout(r, 5000); });
  assert.strictEqual(srv.exitCode, null, `mock Arcade did not start (${PY})`);
  return arcade.client({ base: `http://127.0.0.1:${port}/v1`, key: 'arcade_sk_live_MOCK', pollMs: 0 });
}

const form = (over = {}) => ({ name: 'Harbour Table', handle: '@harbour.table', instagram: '@harbour.table',
  palette: ['#1F4E79', '#F3EAD7', '#C8472D'], styleWords: ['gingham check', 'a scalloped edge', 'citrus slices'],
  images: [{ kind: 'logo', mediaType: 'image/png', dataBase64: IMG('logo.png').toString('base64') },
    { kind: 'reference', mediaType: 'image/png', dataBase64: IMG('pattern-gingham.png').toString('base64') },
    { kind: 'instagram', mediaType: 'image/png', dataBase64: IMG('pattern-citrus.png').toString('base64') }], ...over });

test('onboard (form): 3 images -> 3 referenceIds, default styleRefs include the Instagram image, kit passes', async (t) => {
  const arc = await startMock(t), db = memDb();
  const out = await style.onboard(db, 'u1', form(), { arc });
  assert.strictEqual(out.creatorId, 'creator-harbour-table');
  assert.strictEqual(out.style.images.length, 3);
  assert.ok(out.style.images.every((i) => i.status === 'ready' && /^ref-/.test(i.referenceId)));
  assert.ok(out.style.styleRefs.length <= 3);
  assert.ok(out.style.styleRefs.includes(out.style.images[2].referenceId), 'the Instagram image is a default style ref');
  assert.deepStrictEqual(out.style.palette, ['#1f4e79', '#f3ead7', '#c8472d'], 'hex lowercased');
  const pub = db.store.get('creators/creator-harbour-table'), priv = db.store.get('creators/creator-harbour-table/private/assets');
  assert.strictEqual(pub.instagram, 'harbour.table');
  assert.ok(!/referenceId|byteLength|dataBase64/.test(JSON.stringify(pub)), 'public doc has no asset internals');
  assert.strictEqual(priv.owner, 'u1');
  assert.deepStrictEqual(priv.styleRefs, out.style.styleRefs);
  assert.deepStrictEqual(db.store.get('users/u1'), { role: 'creator', creatorId: 'creator-harbour-table' });
  // rerun: same bytes -> same referenceIds; another uid -> 403
  assert.deepStrictEqual((await style.onboard(db, 'u1', form(), { arc })).style.styleRefs, out.style.styleRefs);
  await assert.rejects(style.onboard(db, 'u2', form(), { arc }), (e) => e.code === 'permission-denied');
  // chosen styleRefs win
  const pick = await style.onboard(db, 'u1', form({ styleRefs: [1] }), { arc });
  assert.deepStrictEqual(pick.style.styleRefs, [out.style.images[1].referenceId]);
  // a form creator + the template planner: the kit's items pass checkItem
  const k = { ...pub, assets: priv.assets, templates: priv.templates };
  assert.deepStrictEqual(M.validateKit({ ...k, schema: 'brand.kit.v0' }), []);
  const r = packs.load('archetype-long-table-host').reading;
  const passing = k.templates.map((tp) => M.templateFill(k, tp, r)).filter((it, i) => it && !M.checkItem(it, k, k.templates[i], r).length);
  assert.ok(passing.length >= 3, `${passing.length} items pass checkItem`);
  assert.ok(priv.templates.find((x) => x.world === 'jewelry').brief.includes('shaped like {brand_element}'));
});

test('onboard (form): bad input -> 400 before any upload', async () => {
  const db = memDb();
  const arc = { reference: async () => assert.fail('no upload for a bad request') };
  const big = Buffer.alloc(1024 * 1024 + 1).toString('base64');
  for (const bad of [{ palette: ['#12345', '#ffffff'] }, { palette: ['red', '#ffffff'] }, { palette: ['#ffffff'] },
    { instagram: '@has space' }, { instagram: 'x'.repeat(31) }, { images: [] }, { styleRefs: [0, 1, 2, 0] },
    { images: [{ kind: 'logo', mediaType: 'image/png', dataBase64: big }] },
    { images: [{ kind: 'logo', mediaType: 'image/svg+xml', dataBase64: 'AAAA' }] }, { handle: '@@@' }]) {
    await assert.rejects(style.onboard(db, 'u1', form(bad), { arc }), (e) => e.code === 'invalid-argument', JSON.stringify(bad).slice(0, 80));
  }
});

test('onboard: a failed image is marked failed and the rest continue; forbidden style words never become the brand element', async () => {
  const db = memDb();
  let n = 0;
  const arc = { reference: async () => { if (n++ === 0) throw new Error('boom'); return `ref-${n}`; } };
  const out = await style.onboard(db, 'u1', form({ styleWords: ['logo', 'photo of food'] }), { arc });
  assert.deepStrictEqual(out.style.images.map((i) => i.status), ['failed', 'ready', 'ready']);
  const priv = db.store.get('creators/creator-harbour-table/private/assets');
  assert.ok(priv.templates.every((x) => x.required_brand_element.join() === 'the signature motif'));
  await assert.rejects(style.onboard(memDb(), 'u1', form(), { arc: { reference: async () => { throw new Error('down'); } } }), (e) => e.code === 'unavailable');
});

test('onboard (fixture): Wishbone Kitchen uploads its 3 fixture PNGs; insights carry role + creatorId', async (t) => {
  const arc = await startMock(t), db = memDb();
  const out = await style.onboard(db, 'uc', { fixture: 'brand_wishbonekitchen' }, { arc });
  assert.strictEqual(out.creatorId, 'creator-wishbonekitchen');
  assert.strictEqual(out.style.styleRefs.length, 3);
  const priv = db.store.get('creators/creator-wishbonekitchen/private/assets');
  assert.deepStrictEqual(Object.keys(priv.referenceIds).sort(), ['logo', 'pattern-citrus', 'pattern-gingham']);
  assert.strictEqual(priv.assets.find((a) => a.assetId === 'logo').byteLength, IMG('logo.png').length);
  await flow.attachInsights(db, 'uc', { pack: 'archetype-small-table-host', role: 'creator' });
  const ins = await flow.getInsights(db, 'uc');
  assert.strictEqual(ins.role, 'creator');
  assert.strictEqual(ins.creatorId, 'creator-wishbonekitchen');
  await flow.attachInsights(db, 'uf', { pack: 'archetype-long-table-host', role: 'fan' });
  assert.deepStrictEqual([(await flow.getInsights(db, 'uf')).role, (await flow.getInsights(db, 'uf')).creatorId], ['fan', null]);
  await assert.rejects(flow.attachInsights(db, 'uf', { pack: 'archetype-long-table-host', role: 'admin' }), (e) => e.code === 'invalid-argument');
});

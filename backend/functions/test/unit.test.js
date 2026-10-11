// npm test   (offline: no emulator, no network). The arcade test starts the local mock:
// ../../arcade/mock_arcade.py --serve (PYTHON env var picks the interpreter; it needs jsonschema).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const packs = require('../src/packs');
const planner = require('../src/planner');
const arcade = require('../src/arcade');
const flow = require('../src/flow');

const REPO = path.resolve(__dirname, '..', '..', '..');
const PY = process.env.PYTHON || 'python';
const clone = (x) => JSON.parse(JSON.stringify(x));
const maya = () => packs.load('creator_maya').reading;

test('packs: the 8 archetype insight packs and the invented fixtures load, valid and marked stub', () => {
  const l = packs.list();
  assert.strictEqual(l.filter((p) => p.kind === 'archetype').length, 8);
  assert.ok(l.some((p) => p.id === 'creator_maya' && p.kind === 'fixture'));
  for (const p of l) assert.strictEqual(packs.load(p.id).reading.stub, true, p.id);
  assert.strictEqual(packs.load('../../package'), null, 'no path tricks');
  assert.strictEqual(packs.load('nope'), null);
});

test('validate: the contract rules (schema, hex palette, anonymous people)', () => {
  assert.throws(() => packs.validate({ ...maya(), schema: 'v9' }), /schema/);
  const r = maya(); r.palette[0].hex = 'red';
  assert.throws(() => packs.validate(r), /palette/);
  assert.throws(() => packs.validate({ ...maya(), people: [{ ref: 'Ola', events: 3 }] }), /anonymous refs/);
});

test('planner: evidence text = planner.py evidence_text', () => {
  const t = planner.evidenceText(maya());
  assert.ok(t.includes('- hand-thrown ceramics (also: pottery studio, glazed stoneware): 41% of moments'), t);
  assert.ok(t.includes('clay #b8714a 22% (lives with)') && t.includes('Kinds of place: studio or workshop 38%'), t);
});

test('planner: check() = planner.py selftest cases', () => {
  const r = maya();
  const good = { store: { name: 'Tide & Clay', tagline: 't', about: 'a', palette: ['#e8dcc6', '#b8714a'] },
    products: [{ category: 'ring', title: 'T', prompt: 'a ring', colors: [], why: 'Ceramics show up in 41% of your moments.', signature: ['hand-thrown ceramics'] },
      { category: 'rug', title: 'R', prompt: 'a rug', colors: ['#B8714A'], why: 'Coastal walks are in 29% of your moments.', signature: ['coastal walks'] }]};
  assert.deepStrictEqual(planner.check(good, ['ring', 'rug'], r), []);
  const bad = clone(good); bad.products[0].why = 'Ceramics show up in 60% of your moments.';
  assert.ok(planner.check(bad, ['ring', 'rug'], r).some((x) => /quote a share/.test(x)), 'an invented share is refused');
  const bad2 = clone(good); bad2.products[1].colors = ['#ff0000'];
  assert.ok(planner.check(bad2, ['ring', 'rug'], r).length, 'colours only from the palette');
  const bad3 = clone(good); bad3.products[0].signature = ['surfing'];
  assert.ok(planner.check(bad3, ['ring', 'rug'], r).length, 'ideas only from the reading');
  const bad4 = clone(good); bad4.products[0].colors = ['#e8dcc6'];
  assert.ok(planner.check(bad4, ['ring', 'rug'], r).some((x) => /jewelry/.test(x)), 'no colours on jewelry');
  assert.ok(planner.check(good, ['ring', 'rug', 'earrings'], r).some((x) => /categories/.test(x)), 'one piece per category');
});

test('planner: no key -> recorded plan for creator_maya, a template plan for every other pack; all pass check()', async () => {
  assert.strictEqual((await planner.plan(maya(), { key: '' }))._model, 'recorded');
  for (const { id } of packs.list()) {
    const r = packs.load(id).reading;
    const p = await planner.plan(r, { key: '' });
    assert.deepStrictEqual(planner.check(p, planner.CATEGORIES, r), [], id);
    assert.ok(p.products.every((x) => x.prompt.length <= 600), id);
  }
  assert.strictEqual((await planner.plan({ ...maya(), stub: false }, { key: '' }))._model, 'template', 'recorded copy is for the stub only');
});

test('planner: with a key -> one Claude call, retried once with the errors', async () => {
  const rec = await planner.plan(maya(), { key: '' });
  const replies = [{ ...rec, products: rec.products.slice(1) }, rec];   // first reply misses the ring
  const bodies = [];
  const fetchImpl = async (url, init) => {
    bodies.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(replies.shift()) }] }) };
  };
  const p = await planner.plan(maya(), { key: 'test-key', fetchImpl });
  assert.strictEqual(bodies.length, 2);
  assert.strictEqual(bodies[0].system, planner.SYSTEM);
  assert.ok(/retry 1: fix: .*categories/.test(bodies[1].messages[0].content));
  assert.strictEqual(p._model, 'claude-opus-5-5');
});

test('arcade client refuses the live host without ARCADE_LIVE', () => {
  delete process.env.ARCADE_LIVE;
  assert.throws(() => arcade.client({ base: 'https://platform.arcade.ai/v1', key: 'x' }), /OFF until the hackathon/);
});

test('pick = run_designs.pick on the categories fixture', (t) => {
  const f = path.join(REPO, 'arcade', 'categories_fixture.json');
  if (!fs.existsSync(f)) return t.skip('arcade/ not next to the app');
  const cats = JSON.parse(fs.readFileSync(f, 'utf8')).items;
  assert.strictEqual(arcade.pick(cats, 'ring').name, 'Rings');
  for (const c of planner.CATEGORIES) assert.ok(arcade.pick(cats, c), `a category for ${c}`);
  assert.strictEqual(arcade.pick(cats, 'teapot'), null);
});

test('mock faults are dropped unless ARCADE_BASE_URL is localhost', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push(init.headers['X-Mock-Fault'] || null); return { ok: true, status: 200, json: async () => ({}), headers: { get: () => null } }; };
  process.env.ARCADE_LIVE = '1';           // never contacts anything: fetchImpl is a stub
  try {
    await arcade.client({ base: 'https://arcade.example.invalid/v1', key: 'k', fetchImpl }).call('patterns/create', {}, { fault: 'job_fail' });
  } finally { delete process.env.ARCADE_LIVE; }
  await arcade.client({ base: 'http://127.0.0.1:1/v1', key: 'k', fetchImpl }).call('patterns/create', {}, { fault: 'job_fail' });
  assert.deepStrictEqual(seen, [null, 'job_fail']);
});

test('offline plans through the real mock Arcade: every piece designs, checkout gives a mock checkoutUrl', async (t) => {
  const mock = path.join(REPO, 'arcade', 'mock_arcade.py');
  if (!fs.existsSync(mock)) return t.skip('arcade/ not next to the app');
  const port = 18000 + Math.floor(Math.random() * 1000);
  const srv = spawn(PY, ['-u', mock, '--serve', String(port)]);
  t.after(() => srv.kill());
  let err = '';
  srv.stderr.on('data', (d) => { err += d; });
  await new Promise((r) => { srv.stdout.on('data', r); srv.on('exit', r); setTimeout(r, 5000); });
  assert.strictEqual(srv.exitCode, null, `mock Arcade did not start (${PY}): ${err.slice(-300)}`);
  const a = arcade.client({ base: `http://127.0.0.1:${port}/v1`, key: 'arcade_sk_live_MOCK', pollMs: 0 });
  const cats = (await a.call('categories/list', {})).items;
  const out = [];
  for (const id of ['creator_maya', 'archetype-grid-keeper']) {
    const p = await planner.plan(packs.load(id).reading, { key: '' });
    for (const x of p.products) {
      const cat = arcade.pick(cats, x.category);
      out.push(await a.design(x.prompt, cat.categoryId, { colors: cat.world === 'print' ? x.colors : undefined, requestId: `t-${id}-${x.category}` }));
    }
  }
  assert.ok(out.every((r) => r.ok && r.product.unitPrice.mock === true), JSON.stringify(out.filter((r) => !r.ok)));
  const jf = await a.design('a ring', arcade.pick(cats, 'ring').categoryId, { requestId: 'jf', fault: 'job_fail' });
  assert.ok(!jf.ok && jf.stage === 'job');
  const co = await a.call('checkouts/create', { requestId: 'c1', lines: [{ productId: out[3].product.productId, quantity: 1 }], dropShip: true });
  assert.ok(co.mock === true && co.checkoutUrl.startsWith(`http://127.0.0.1:${port}/mock/checkout/`));
  // brand assets upload once as references; print designs carry them, jewelry is refused them
  const ref = await a.reference('image/png', 48211, 'asset-logo');
  assert.strictEqual(await a.reference('image/png', 48211, 'asset-logo'), ref, 'same requestId -> same referenceId');
  const pr = await a.design('A wall print with stripes', arcade.pick(cats, 'wall art print').categoryId, { requestId: 'ref-1', referenceIds: [ref], colors: ['#b8714a'] });
  assert.ok(pr.ok && pr.request.referenceIds[0] === ref);
  const jr = await a.design('A pendant', arcade.pick(cats, 'pendant necklace').categoryId, { requestId: 'ref-2', referenceIds: [ref] });
  assert.ok(!jr.ok && jr.stage === 'admit', 'jewelry refuses referenceIds');
});

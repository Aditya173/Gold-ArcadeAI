// npm test (offline). The brand-template marketplace rules: marketplace.py selftest cases, ported.
const test = require('node:test');
const assert = require('node:assert');
const M = require('../src/marketplace');
const packs = require('../src/packs');

const kit = () => M.fixture('brand_tide_and_clay');
const tpl = (k, id) => k.templates.find((t) => t.templateId === id);
const fan = (id = 'archetype-first-light-solitary') => packs.load(id).reading;
const FANS = [['tc-print', 'archetype-first-light-solitary'], ['tc-pillow', 'archetype-small-table-host'], ['tc-pendant', 'archetype-night-shift-builder']];

function good() {
  const r = fan(), idea = r.signature[0];
  return { r, idea, item: { title: 'Ridge Rings', brief: `A 12x16 in wall print: thrown-ring stripes framing ${idea.idea}. Flat colour, no faces.`,
    fan_idea: idea.idea, colors: ['#b8714a', '#9fb8ad'], why_owner: `It shows up in ${Math.round(idea.share_of_events * 100)}% of your moments.`,
    public_tag: 'for early risers' } };
}

test('validate_kit: the Tide & Clay kit passes; broken kits are refused', () => {
  assert.deepStrictEqual(M.validateKit(kit()), []);
  const k = kit(); k.templates[2].uses_assets = ['logo'];
  assert.ok(M.validateKit(k).some((e) => /jewelry takes no references/.test(e)));
  const k2 = kit(); k2.templates[0].uses_assets = ['nope'];
  assert.ok(M.validateKit(k2).some((e) => /unknown asset/.test(e)));
  const k3 = kit(); k3.templates[0].brief = 'no motif slot';
  assert.ok(M.validateKit(k3).length);
  assert.ok(M.validateKit({ ...kit(), schema: 'x' }).length);
  assert.ok(M.validateKit({ ...kit(), creatorId: 'a/b' }).length);
});

test('check_item = marketplace.py selftest: a good print item passes, each broken rule is caught', () => {
  const k = kit(), t = tpl(k, 'tc-print');
  const { r, item } = good();
  assert.deepStrictEqual(M.checkItem(item, k, t, r), []);
  for (const [bad, why] of [
    [{ ...item, colors: ['#b8714a'] }, 'too few brand colours'],
    [{ ...item, brief: item.brief.replace('thrown-ring stripes', 'stripes') }, 'brand element missing'],
    [{ ...item, brief: item.brief + ' Add the Tide & Clay logo.' }, 'forbidden word'],
    [{ ...item, brief: item.brief + ' By Tide & Clay.' }, 'creator name'],
    [{ ...item, why_owner: 'It shows up in 99% of your moments.' }, "quote the idea's share"],
    [{ ...item, colors: ['#b8714a', '#9fb8ad', '#ff0000'] }, 'neither brand nor fan'],
    [{ ...item, fan_idea: 'surfing' }, 'not one of the fan'],
    [{ ...item, public_tag: 'for 5am people' }, 'public_tag'],
    [{ ...item, public_tag: 'for people who get up very early' }, 'public_tag'],
    [{ ...item, brief: 'A {size} wall print: thrown-ring stripes.' }, 'unfilled slot'],
  ]) assert.ok(M.checkItem(bad, k, t, r).some((e) => e.includes(why)), `${why}: ${M.checkItem(bad, k, t, r)}`);
  const fanAccent = r.palette.map((c) => c.hex).find((h) => !k.palette.some((c) => c.hex === h));
  assert.deepStrictEqual(M.checkItem({ ...item, colors: [...item.colors, fanAccent] }, k, t, r), [], 'one fan accent is allowed');
  const other = fan('archetype-grid-keeper').palette.map((c) => c.hex).filter((h) => !r.palette.some((c) => c.hex === h) && !k.palette.some((c) => c.hex === h));
  if (other.length) assert.ok(M.checkItem({ ...item, colors: [...item.colors, other[0]] }, k, t, r).length, "another fan's colour is refused");
});

test('check_item: jewelry takes no colours', () => {
  const k = kit(), tj = tpl(k, 'tc-pendant');
  const { r, idea, item } = good();
  const gj = { ...item, brief: `A sterling silver pendant in the shape of the wave-and-wheel mark, a small engraved ${idea.idea} on the back. No stones.`, colors: [] };
  assert.deepStrictEqual(M.checkItem(gj, k, tj, r), []);
  assert.ok(M.checkItem({ ...gj, colors: ['#b8714a', '#9fb8ad'] }, k, tj, r).some((e) => /jewelry/.test(e)));
});

test('the recorded items pass check_item', () => {
  const k = kit(), rec = M.fixture('recorded_items');
  for (const [tid, pack] of FANS) assert.deepStrictEqual(M.checkItem(rec[`${tid}|${pack}`], k, tpl(k, tid), fan(pack)), [], tid);
});

test('template fill: every pack x every template gives an item that passes check_item, with a non-personal tag', () => {
  const k = kit();
  for (const t of k.templates) for (const { id } of packs.list()) {
    const r = fan(id), it = M.templateFill(k, t, r);
    assert.ok(it, `${t.templateId} x ${id}`);
    assert.deepStrictEqual(M.checkItem(it, k, t, r), [], `${t.templateId} x ${id}`);
    assert.ok(!it.public_tag.includes(it.fan_idea));
  }
});

test('planItem: recorded first, then one Claude call when a key is set, else the template fill', async () => {
  const k = kit();
  assert.strictEqual((await M.planItem(k, tpl(k, 'tc-print'), fan(), { key: '' })).model, 'recorded');
  assert.strictEqual((await M.planItem(k, tpl(k, 'tc-print'), fan('archetype-grid-keeper'), { key: '' })).model, 'template');
  const sent = [];
  const fetchImpl = async (url, init) => { sent.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"title":"x"}' }] }) }; };
  const p = await M.planItem(k, tpl(k, 'tc-print'), fan('archetype-grid-keeper'), { key: 'k', fetchImpl });
  assert.strictEqual(p.model, 'claude-opus-5-5');
  assert.strictEqual(sent[0].system, M.SYSTEM);
  assert.ok(sent[0].messages[0].content.includes('Required brand element (one of)'));
});

test('the public kit carries no asset internals (no referenceIds, sizes or template briefs)', () => {
  const pub = M.publicKit(kit());
  const text = JSON.stringify(pub);
  assert.ok(!/byteLength|mediaType|describe|referenceId|\{fan_motif\}/.test(text), text);
  assert.deepStrictEqual(pub.templates.map((t) => t.templateId), ['tc-print', 'tc-pillow', 'tc-pendant']);
});

// ---- U3 + U5: suggest, suggestions, universal feed, creator search, buy (in-memory Firestore + fake Arcade) ----
const fs = require('fs');
const path = require('path');
const arcadeMod = require('../src/arcade');
const CATS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'arcade', 'categories_fixture.json'), 'utf8')).items;
const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

function fakeDb() {
  const store = new Map();
  let auto = 0;
  const snap = (p) => ({ exists: store.has(p), id: p.split('/').pop(), data: () => clone(store.get(p)) });
  function docRef(p) {
    return { id: p.split('/').pop(), path: p, get: async () => snap(p), set: async (d) => { store.set(p, clone(d)); },
      update: async (u) => {
        if (!store.has(p)) throw new Error(`no doc ${p}`);
        const d = store.get(p);
        for (const [k, v] of Object.entries(u)) {
          const ks = k.split('.'); let o = d;
          for (const x of ks.slice(0, -1)) o = o[x] ||= {};
          const last = ks[ks.length - 1];
          o[last] = v && v.constructor && v.constructor.name === 'NumericIncrementTransform' ? (o[last] || 0) + v.operand : clone(v);
        }
      },
      collection: (n) => colRef(`${p}/${n}`) };
  }
  function colRef(p) {
    const keys = () => [...store.keys()].filter((k) => k.startsWith(`${p}/`) && !k.slice(p.length + 1).includes('/'));
    const q = (fs_) => ({ where: (f, op, v) => q([...fs_, [f, v]]),
      get: async () => ({ docs: keys().map(snap).filter((s) => fs_.every(([f, v]) => s.data()[f] === v)) }) });
    return { doc: (id) => docRef(`${p}/${id ?? `auto${++auto}`}`), ...q([]) };
  }
  return { collection: colRef, getAll: async (...refs) => Promise.all(refs.map((r) => r.get())), store };
}

function fakeArc() {
  const designs = [], calls = [];
  const product = (id) => ({ productId: id, imageUrl: `https://mock.arcade.invalid/${id}.png`, images: [{ url: `https://mock.arcade.invalid/${id}.png` }],
    unitPrice: { amount: '48.00', currency: 'USD', mock: true }, selectionLabel: 'standard', maker: { name: 'Mock Maker' }, description: 'Mock product.' });
  return { designs, calls,
    async call(proc, body) {
      calls.push([proc, body]);
      if (proc === 'categories/list') return { items: CATS };
      if (proc === 'products/get') return product(body.productId);
      if (proc === 'checkouts/create') return { checkoutId: `co-${body.requestId}`, checkoutUrl: 'https://mock.arcade.invalid/checkout', mock: true };
      throw new Error(`unexpected ${proc}`);
    },
    async design(prompt, categoryId, opts = {}) {
      designs.push({ prompt, categoryId, ...opts });
      if (opts.fault) return { ok: false, stage: 'job', reason: 'mock job failed' };
      return { ok: true, product: product(`prod-${opts.requestId}`) };
    } };
}

const WK = 'creator-wishbonekitchen';
async function seedCreator(db, { kitName = 'brand_wishbonekitchen', owner = 'u-creator', styleRefs, edit } = {}) {
  const k = M.fixture(kitName);
  if (edit) edit(k);
  const refs = Object.fromEntries(k.assets.map((a) => [a.assetId, `ref-${a.assetId}`]));
  await db.collection('creators').doc(k.creatorId).set({ ...M.publicKit(k), instagram: '@' + (k.handle || 'x'), styleWords: ['sunny', 'generous'], createdAt: 1 });
  await db.collection('creators').doc(k.creatorId).collection('private').doc('assets')
    .set({ owner, assets: k.assets, referenceIds: refs, templates: k.templates, ...(styleRefs ? { styleRefs } : {}) });
  return k;
}
const attach = (db, uid, pack) => db.collection('users').doc(uid).collection('insights').doc('current').set({ pack, reading: packs.load(pack).reading });

test('suggest (fan, Long-Table Host): 4 listed items, maker fan, 4 code-built reasons quoting the exact %, owner-only', async () => {
  const db = fakeDb(), arc = fakeArc();
  await seedCreator(db);
  await attach(db, 'u-fan', 'archetype-long-table-host');
  const r = packs.load('archetype-long-table-host').reading;
  const out = await M.suggest(db, 'u-fan', { creatorId: WK, count: 4 }, { arc });
  assert.strictEqual(out.items.length, 4);
  for (const it of out.items) {
    assert.strictEqual(it.status, 'listed', `${it.category}: ${it.reason}`);
    assert.strictEqual(it.maker, 'fan');
    assert.ok(it.imageUrl && it.price && it.why);
    assert.deepStrictEqual(it.reasons.map((x) => x.kind), ['insight', 'colour', 'style', 'product'], it.category);
    const idea = r.signature.find((s) => s.idea === it.reasons[0].idea);
    assert.ok(idea && it.reasons[0].text.includes(`${Math.round(idea.share_of_events * 100)}%`), it.reasons[0].text);
  }
  // print sends the template's referenceIds (no styleRefs on this kit); jewelry sends no referenceIds or colors
  const pend = arc.designs.find((d) => /pendant/.test(d.prompt));
  assert.ok(pend && pend.referenceIds === undefined && pend.colors === undefined);
  const runner = arc.designs.find((d) => /runner/.test(d.prompt));
  assert.deepStrictEqual(runner.referenceIds, ['ref-pattern-gingham', 'ref-pattern-citrus']);
  assert.ok(runner.colors.length >= 2);
  // public feed: no reasons, no why; mine only for the maker
  const pub = await M.feed(db, null, {}, { arc });
  assert.strictEqual(pub.items.length, 4);
  assert.ok(!/reasons|owner_only|"why"|makerUid/.test(JSON.stringify(pub)), 'nothing owner-only in the feed');
  assert.ok(pub.items.every((i) => i.mine === false && i.creatorName === 'Wishbone Kitchen' && i.maker === 'fan'));
  assert.ok((await M.feed(db, 'u-fan', {}, { arc })).items.every((i) => i.mine === true));
  // GET /suggestions: same items via getAll; another uid sees none
  assert.strictEqual((await M.suggestions(db, 'u-fan', { creatorId: WK, count: 4 })).items.length, 4);
  assert.strictEqual((await M.suggestions(db, 'u-other', { creatorId: WK, count: 4 })).items.length, 0);
  // item detail: owner.why only for the maker
  const id = out.items[0].itemId;
  assert.ok((await M.getItem(db, 'u-fan', { itemId: id }, { arc })).owner.reasons.length === 4);
  assert.ok(!('owner' in (await M.getItem(db, 'u-x', { itemId: id }, { arc }))));
  // rerun: no duplicates, no new Arcade designs
  const n = arc.designs.length, docs = db.store.size;
  await M.suggest(db, 'u-fan', { creatorId: WK, count: 4 }, { arc });
  assert.strictEqual(arc.designs.length, n);
  assert.strictEqual(db.store.size, docs);
});

test('suggest: creator caller -> maker creator; form creator print items send styleRefs (<=3)', async () => {
  const db = fakeDb(), arc = fakeArc();
  await seedCreator(db, { owner: 'u-creator', styleRefs: ['s1', 's2', 's3', 's4'] });
  await attach(db, 'u-creator', 'archetype-small-table-host');
  const out = await M.suggest(db, 'u-creator', { creatorId: WK, count: 3 }, { arc });
  assert.strictEqual(out.items.length, 3);
  assert.ok(out.items.every((i) => i.maker === 'creator' && i.status === 'listed'), JSON.stringify(out.items.map((i) => i.reason)));
  for (const d of arc.designs) assert.deepStrictEqual(d.referenceIds, ['s1', 's2', 's3']);
});

test('suggest: one item forced to fail ends not_makeable, the others list; a retry uses a new requestId', async () => {
  const db = fakeDb(), arc = fakeArc();
  await seedCreator(db);
  await attach(db, 'u-fan', 'archetype-long-table-host');
  const out = await M.suggest(db, 'u-fan', { creatorId: WK, count: 3 }, { arc, faults: { 'wk-plate': 'job_fail' } });
  const byCat = Object.fromEntries(out.items.map((i) => [i.category, i]));
  assert.strictEqual(byCat['ceramic plate'].status, 'not_makeable');
  assert.ok(byCat['ceramic plate'].reason);
  assert.strictEqual(out.items.filter((i) => i.status === 'listed').length, 2);
  const id = byCat['ceramic plate'].itemId;
  assert.ok(arc.designs.find((d) => d.requestId === `${id}-0`));
  const again = await M.suggest(db, 'u-fan', { creatorId: WK, count: 3 }, { arc });
  assert.ok(again.items.every((i) => i.status === 'listed'));
  assert.ok(arc.designs.find((d) => d.requestId === `${id}-1`), 'attempts went up');
  assert.strictEqual(arc.designs.length, 4, 'listed items were not remade');
});

test('suggest: 404 for an unknown creator, 409 without a Gold reading', async () => {
  const db = fakeDb(), arc = fakeArc();
  await seedCreator(db);
  await assert.rejects(M.suggest(db, 'u-fan', { creatorId: 'creator-nope' }, { arc }), (e) => e.code === 'not-found');
  await assert.rejects(M.suggest(db, 'u-fan', { creatorId: WK }, { arc }), (e) => e.code === 'failed-precondition');
});

test('feed across 2 creators: filters, popular sort, refresh of a null price; search puts Wishbone Kitchen first', async () => {
  const db = fakeDb(), arc = fakeArc();
  await seedCreator(db, { owner: 'u-creator' });
  await seedCreator(db, { kitName: 'brand_tide_and_clay', owner: 'u-tc' });
  await attach(db, 'u-fan', 'archetype-long-table-host');
  await attach(db, 'u-tc', 'archetype-first-light-solitary');
  await M.suggest(db, 'u-fan', { creatorId: WK, count: 2 }, { arc });
  const tcId = M.fixture('brand_tide_and_clay').creatorId;
  await M.suggest(db, 'u-tc', { creatorId: tcId, count: 3 }, { arc });
  const all = (await M.feed(db, null, {}, { arc })).items;
  assert.strictEqual(all.length, 5);
  assert.strictEqual((await M.feed(db, null, { creatorId: WK }, { arc })).items.length, 2);
  assert.ok((await M.feed(db, null, { maker: 'creator' }, { arc })).items.every((i) => i.creatorId === tcId));
  assert.strictEqual((await M.feed(db, null, { maker: 'fan' }, { arc })).items.length, 2);
  assert.ok((await M.feed(db, null, { category: 'textile' }, { arc })).items.every((i) => i.category === 'textile'));
  const top = all[3].itemId;
  await db.collection('marketplace').doc(top).update({ 'stats.buys': 5, price: null });
  const pop = await M.feed(db, null, { sort: 'popular' }, { arc });
  assert.strictEqual(pop.items[0].itemId, top);
  assert.ok(pop.items[0].price, 'a null price is read again from Arcade');
  assert.strictEqual(pop.items[0].stats.buys, 5);
  // a feed item carries the fields S8 needs
  for (const k of ['itemId', 'imageUrl', 'title', 'price', 'creatorName', 'maker', 'category', 'stats', 'mine']) assert.ok(k in pop.items[0], k);
  // creator search
  const cs = (await M.listCreators(db, {})).creators;
  assert.strictEqual(cs[0].creatorId, WK, 'Wishbone Kitchen first even with fewer items');
  assert.deepStrictEqual(cs.map((c) => c.listedCount), [2, 3]);
  assert.strictEqual((await M.listCreators(db, { q: 'wish' })).creators.length, 1);
  assert.strictEqual((await M.listCreators(db, { q: '@wishbonekitchen' })).creators[0].creatorId, WK);
  assert.strictEqual((await M.listCreators(db, { q: 'zzz' })).creators.length, 0);
  const c = await M.getCreator(db, { creatorId: WK });
  assert.ok(c.name && c.handle && c.palette.length && Array.isArray(c.styleWords) && 'instagram' in c);
});

test('buy: returns checkoutId, counts the buy; a ring is refused with 409 before any checkout', async () => {
  const db = fakeDb(), arc = fakeArc();
  await seedCreator(db);
  await attach(db, 'u-fan', 'archetype-long-table-host');
  const [it] = (await M.suggest(db, 'u-fan', { creatorId: WK, count: 1 }, { arc })).items;
  const b = await M.buy(db, 'u-buyer', { itemId: it.itemId, quantity: 1 }, { arc });
  assert.ok(b.orderId && b.checkoutId && b.checkoutUrl && b.mock === true);
  assert.strictEqual((await db.collection('marketplace').doc(it.itemId).get()).data().stats.buys, 1);
  const co = arc.calls.find(([p]) => p === 'checkouts/create')[1];
  assert.strictEqual(co.dropShip, true);
  await db.collection('marketplace').doc('ring-1').set({ itemId: 'ring-1', creatorId: WK, category: 'ring', status: 'listed', productId: 'p', stats: { buys: 0 } });
  const before = arc.calls.length;
  await assert.rejects(M.buy(db, 'u-buyer', { itemId: 'ring-1', quantity: 1 }, { arc }), (e) => e.code === 'failed-precondition');
  assert.strictEqual(arc.calls.length, before, 'no checkout for a ring');
});

test('index.js: routes answer; a route whose export is not built yet answers 501 before auth', async () => {
  const { api } = require('../index');
  const call = async (method, p) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, redirect(c, u) { this.code = c; this.loc = u; } };
    await api.handle({ method, path: p, get: () => '', body: {}, query: {} }, res);
    return res;
  };
  assert.strictEqual((await call('GET', '/packs')).code, 200);
  assert.strictEqual((await call('GET', '/nope')).code, 404);
  assert.strictEqual((await call('DELETE', '/packs')).code, 405);
  assert.strictEqual((await call('POST', '/suggest')).code, 401, 'built + auth required -> 401');
  for (const [mod, fn, method, p] of [['style', 'onboard', 'POST', '/creators/onboard'], ['instagram', 'connect', 'GET', '/instagram/connect'],
    ['instagram', 'status', 'GET', '/instagram/status'], ['instagram', 'media', 'GET', '/instagram/media']]) {
    let built = false;
    try { built = typeof require(`../src/${mod}`)[fn] === 'function'; } catch { built = false; }
    assert.strictEqual((await call(method, p)).code, built ? 401 : 501, `${method} ${p}`);
  }
});

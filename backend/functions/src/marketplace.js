// Idea 7, the brand-template marketplace: a JS port of marketplace/marketplace.py (validate_kit, SYSTEM, user_msg,
// check_item, recorded items). A creator publishes a brand kit (brand.kit.v0); a fan fills one of its templates
// with an idea from their own Gold reading; every piece made is listed on the creator's marketplace.
// Firestore:
//   creators/{creatorId}                public: the kit without asset internals or template briefs (no uid)
//   creators/{creatorId}/private/assets owner-only: owner uid, the assets, their Arcade referenceIds, full templates
//   marketplace/{itemId}                public once listed: the piece, price, optional tag. Never the fan's reading
//   marketplace/{itemId}/private/owner  maker-only: makerUid + owner_only {fan_idea, why}
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { FieldValue } = require('firebase-admin/firestore');
const planner = require('./planner');
const arcade = require('./arcade');

const HEX = /^#[0-9a-f]{6}$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const FIXTURES = [path.join(__dirname, '..', 'data', 'marketplace'), path.join(__dirname, '..', '..', '..', 'marketplace', 'fixtures')];
const pct = (x) => `${Math.round(x * 100)}%`;
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

const { HttpsishError } = require('./flow');
const fail = (code, msg) => { throw new HttpsishError(code, msg); };

function fixture(name) {
  if (!/^[a-z0-9_]+$/.test(name || '')) return null;
  const f = FIXTURES.map((d) => path.join(d, `${name}.json`)).find((x) => fs.existsSync(x));
  return f ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

// = marketplace.SYSTEM, verbatim
const SYSTEM = `You design ONE made-to-order piece for a fan, inside a creator's brand. The creator's
template is fixed: keep its brand element and its rules. The fan's Gold reading says what is
distinctive about them; the piece's personal motif must come from it.

Return ONLY JSON: {"title": str (2-4 words), "brief": str (<= 600 chars: the template filled in,
with {fan_motif} replaced by a concrete, makeable motif drawn from ONE of the fan's ideas, and every
other {slot} filled from its allowed values), "fan_idea": the idea name copied exactly from the
reading, "colors": [hex] (print only: at least the rule's minimum of BRAND colours copied from the
brand palette, plus at most the allowed number of fan accent colours copied from the fan palette;
[] for jewelry), "why_owner": str (1 sentence to the fan quoting the idea's share exactly as given,
e.g. "coastal walks show up in 29% of your moments"), "public_tag": str (<= 6 words, non-personal,
no numbers, e.g. "for early-morning walkers")}.
Never put the creator's name, any text, letters or a logo description in the brief: the logo and
patterns travel as reference images. Never name cities, brands or people.`;

// = marketplace.validate_kit (returns errors instead of asserting, so the API can answer 400)
function validateKit(k) {
  const errs = [];
  if (!k || k.schema !== 'brand.kit.v0') return ['schema must be brand.kit.v0'];
  if (!ID.test(k.creatorId || '')) errs.push('creatorId: 1-64 of A-Z a-z 0-9 _ -');
  if (!k.name) errs.push('name missing');
  if (!(k.palette || []).length) errs.push('palette missing');
  if (!(k.palette || []).every((c) => HEX.test(c.hex))) errs.push('palette hex must be #rrggbb lowercase');
  const ids = new Set((k.assets || []).map((a) => a.assetId));
  for (const t of k.templates || []) {
    if (!['print', 'jewelry'].includes(t.world) || !String(t.brief || '').includes('{fan_motif}')) errs.push(`${t.templateId}: world and {fan_motif}`);
    if (!(t.uses_assets || []).every((a) => ids.has(a))) errs.push(`${t.templateId}: unknown asset`);
    if (t.world === 'jewelry' && (t.uses_assets || []).length) errs.push(`${t.templateId}: jewelry takes no references`);
  }
  if (!(k.templates || []).length) errs.push('templates missing');
  const r = k.rules || {};
  if (!Number.isInteger(r.min_brand_colors) || !Number.isInteger(r.fan_accent_colors) || !Array.isArray(r.forbidden_words)) errs.push('rules incomplete');
  return errs;
}

const fanText = (r) => "Fan's reading (share of their moments):\n" + r.signature.map((s) => `- ${s.idea}: ${pct(s.share_of_events)} of moments`).join('\n') +
  '\nFan palette: ' + r.palette.map((c) => `${c.name} ${c.hex}`).join(', ');

const userMsg = (k, t, r) => `Creator: ${k.name} (voice: ${k.voice})\nBrand palette: ` +
  k.palette.map((c) => `${c.name} ${c.hex} (${c.role})`).join(', ') +
  `\nRules: at least ${k.rules.min_brand_colors} brand colours; at most ${k.rules.fan_accent_colors} fan accent colour(s); forbidden words ${JSON.stringify(k.rules.forbidden_words)}` +
  `\nTemplate (${t.category}, ${t.world}): ${t.brief}\nRequired brand element (one of): ${JSON.stringify(t.required_brand_element)}\nSlot values: ${JSON.stringify(t.slots || {})}\n\n` + fanText(r);

const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// = marketplace.check_item
function checkItem(item, k, t, r) {
  const errs = [];
  const brand = new Set(k.palette.map((c) => c.hex));
  const fan = new Set(r.palette.map((c) => c.hex));
  const brief = item.brief || '';
  if (!(brief.length > 0 && brief.length <= 1000)) errs.push('brief length');
  if (brief.includes('{')) errs.push('unfilled slot');
  const low = brief.toLowerCase();
  if (!t.required_brand_element.some((e) => low.includes(e.toLowerCase()))) errs.push('brand element missing');
  for (const w of k.rules.forbidden_words) if (new RegExp(`\\b${esc(w.toLowerCase())}\\b`).test(low)) errs.push(`forbidden word '${w}'`);
  if (low.includes(k.name.toLowerCase())) errs.push('creator name in the brief (the brand travels as references)');
  const idea = r.signature.find((s) => s.idea === item.fan_idea);
  if (!idea) errs.push("fan_idea is not one of the fan's ideas");
  else if (!(item.why_owner || '').includes(pct(idea.share_of_events))) errs.push("why_owner must quote the idea's share exactly");
  const cols = (item.colors || []).map((c) => String(c).toLowerCase());
  if (t.world === 'jewelry') {
    if (cols.length) errs.push('jewelry takes no colours');
  } else {
    if (cols.filter((c) => brand.has(c)).length < k.rules.min_brand_colors) errs.push('too few brand colours');
    const extra = cols.filter((c) => !brand.has(c));
    if (extra.some((c) => !fan.has(c))) errs.push('a colour is neither brand nor fan palette');
    if (extra.length > k.rules.fan_accent_colors) errs.push('too many fan accent colours');
  }
  const tag = item.public_tag || '';
  if (/\d/.test(tag) || tag.split(/\s+/).filter(Boolean).length > 6) errs.push('public_tag must be short and number-free');
  return errs;
}

// Offline stand-in when there is no recorded item and no Claude key: the template filled from the fan's strongest
// idea that passes check_item. ponytail: plain copy ("a small <idea> detail"); Claude writes the real motif
function templateFill(k, t, r) {
  const brandCols = [...k.palette].sort((a, b) => (a.role === 'primary' ? 0 : 1) - (b.role === 'primary' ? 0 : 1)).map((c) => c.hex);
  const accent = r.palette.map((c) => c.hex).find((h) => !brandCols.includes(h));
  const colors = t.world === 'jewelry' ? [] : [...brandCols.slice(0, Math.max(k.rules.min_brand_colors, 2)), ...(k.rules.fan_accent_colors > 0 && accent ? [accent] : [])];
  for (const s of [...r.signature].sort((a, b) => b.strength - a.strength || b.share_of_events - a.share_of_events)) {
    const slots = { ...Object.fromEntries(Object.entries(t.slots || {}).map(([n, v]) => [n, v[0]])), brand_element: t.required_brand_element[0], fan_motif: s.idea };
    const item = { title: cap(s.idea).split(' ').slice(0, 4).join(' '), brief: t.brief.replace(/\{(\w+)\}/g, (m, n) => slots[n] ?? m),
      fan_idea: s.idea, colors, why_owner: `${cap(s.idea)} shows up in ${pct(s.share_of_events)} of your moments.`,
      public_tag: 'a fan-made piece' };   // never the fan's idea: the tag can be public
    if (!checkItem(item, k, t, r).length) return item;
  }
  return null;
}

// recorded (offline, hand-written) -> one Claude call when ANTHROPIC_API_KEY is set -> template fill
async function planItem(k, t, r, { key = process.env.ANTHROPIC_API_KEY, fetchImpl = fetch } = {}) {
  const rec = (fixture('recorded_items') || {})[`${t.templateId}|${r.subject}`];
  if (rec) return { item: rec, model: 'recorded' };
  if (key) return { item: await planner.askClaude(SYSTEM, userMsg(k, t, r), { key, fetchImpl }), model: 'claude-opus-5-5' };
  return { item: templateFill(k, t, r), model: 'template' };
}

const publicKit = (k) => ({ schema: k.schema, creatorId: k.creatorId, name: k.name, handle: k.handle || null, voice: k.voice || null,
  palette: k.palette, motifs: k.motifs || [], assets: (k.assets || []).map(({ assetId, kind }) => ({ assetId, kind })),
  templates: k.templates.map(({ templateId, category, world, required_brand_element }) => ({ templateId, category, world, required_brand_element })),
  rules: k.rules });

async function createCreator(db, uid, data, { arc = arcade.client() } = {}) {
  const k = data && data.fixture ? fixture(data.fixture) : data;
  if (!k) fail('invalid-argument', 'unknown fixture');
  const errs = validateKit(k);
  if (errs.length) fail('invalid-argument', `brand kit: ${errs.join('; ')}`);
  const ref = db.collection('creators').doc(k.creatorId);
  const [prev, prevPriv] = await Promise.all([ref.get(), ref.collection('private').doc('assets').get()]);
  if (prevPriv.exists && prevPriv.data().owner !== uid) fail('permission-denied', 'that creatorId belongs to someone else');
  const refs = {};
  for (const a of k.assets || []) refs[a.assetId] = await arc.reference(a.mediaType, a.byteLength, arcade.rid('asset', k.creatorId, a.assetId, a.byteLength));
  await ref.set({ ...publicKit(k), createdAt: prev.exists ? prev.data().createdAt : Date.now(), updatedAt: Date.now() });
  await ref.collection('private').doc('assets').set({ owner: uid, assets: k.assets || [], referenceIds: refs, templates: k.templates });
  return { creatorId: k.creatorId, assets: Object.keys(refs).length };
}

async function getCreator(db, data) {
  const s = await db.collection('creators').doc(data.creatorId).get();
  if (!s.exists) fail('not-found', 'no such creator');
  const d = s.data();
  return { ...d, name: d.name, handle: d.handle || null, palette: d.palette || [], styleWords: d.styleWords || [], instagram: d.instagram || null };
}

// kit categories that arcade.pick does not know by that exact name
const CAT_ALIAS = { 'ceramic plate': 'ceramic', 'table runner': 'textile' };
const pickCat = (cats, category) => arcade.pick(cats, category) || arcade.pick(cats, CAT_ALIAS[category]);
// print referenceIds (2.6): the creator's chosen styleRefs, else the template's assets; at most 3. Jewelry: none.
const refsFor = (t, priv) => (t.world === 'print'
  ? ((priv.styleRefs && priv.styleRefs.length ? priv.styleRefs : (t.uses_assets || []).map((a) => (priv.referenceIds || {})[a])).filter(Boolean).slice(0, 3))
  : undefined);
const productFields = (p) => ({ productId: p.productId, imageUrl: p.imageUrl || null, images: (p.images || []).map((i) => i.url || i).filter(Boolean),
  price: p.unitPrice || null, selectionLabel: p.selectionLabel || null, makerName: (p.maker || {}).name || null,
  description: p.description || null, imageFetchedAt: Date.now() });

// the fan's reading comes from their attached insight pack (users/{uid}/insights/current)
async function makeItem(db, uid, data, { arc = arcade.client(), plan = planItem } = {}) {
  const c = db.collection('creators').doc(data.creatorId);
  const priv = (await c.collection('private').doc('assets').get()).data();
  const pub = (await c.get()).data();
  if (!pub || !priv) fail('not-found', 'no such creator');
  const k = { ...pub, assets: priv.assets, templates: priv.templates };
  const t = k.templates.find((x) => x.templateId === data.templateId);
  if (!t) fail('invalid-argument', 'unknown templateId');
  const ins = await db.collection('users').doc(uid).collection('insights').doc('current').get();
  if (!ins.exists) fail('failed-precondition', 'attach an insight pack first (POST /users/{uid}/insights)');
  const r = ins.data().reading;
  const { item, model } = await plan(k, t, r);
  const errs = item ? checkItem(item, k, t, r) : ['no plan'];
  if (errs.length) fail('failed-precondition', `item rejected: ${errs.join('; ')}`);
  const itemId = 'itm-' + crypto.createHash('sha256').update(`${k.creatorId}|${uid}|${t.templateId}|${item.brief}`).digest('hex').slice(0, 12);
  const cat = pickCat((await arc.call('categories/list', {})).items, t.category);
  const rec = cat ? await arc.design(item.brief, cat.categoryId, { requestId: itemId,
    colors: t.world === 'print' ? item.colors : undefined, referenceIds: refsFor(t, priv) })
    : { ok: false, reason: `no category for ${t.category}` };
  const showTag = !k.rules.public_tag_requires_opt_in || data.showTag === true;
  const doc = { itemId, creatorId: k.creatorId, templateId: t.templateId, category: t.category, world: t.world, title: item.title,
    brief: item.brief, colors: item.colors || [], public_tag: showTag ? item.public_tag : null, royalty_pct: k.rules.royalty_pct ?? null,
    model, stats: { buys: 0 }, createdAt: Date.now(),
    ...(rec.ok ? { status: 'listed', productId: rec.product.productId, imageUrl: rec.product.imageUrl, price: rec.product.unitPrice || null }
      : { status: 'not_makeable', reason: rec.reason || null }) };
  const m = db.collection('marketplace').doc(itemId);
  const prev = await m.get();
  if (prev.exists) doc.stats = prev.data().stats;     // remaking the same piece keeps its history
  await m.set(doc);
  await m.collection('private').doc('owner').set({ makerUid: uid, owner_only: { fan_idea: item.fan_idea, why: item.why_owner }, public_tag: item.public_tag });
  return { ...doc, owner_only: { fan_idea: item.fan_idea, why: item.why_owner } };
}

// ---- suggestions (2.6) ----
// where a category lives, matched against the reading's places[] (pendant/jewelry: nowhere in particular)
const PLACES = { textile: ['dining table', 'kitchen'], 'ceramic plate': ['dining table', 'kitchen'], ceramic: ['dining table', 'kitchen'],
  'wall art print': ['kitchen'], 'throw pillow': ['living room', 'home'], rug: ['living room', 'home'] };

// the "why we chose this" list, built from data we already hold so every line is true (never written by the model)
function buildReasons(item, k, t, r) {
  const out = [];
  const idea = r.signature.find((s) => s.idea === item.fan_idea);
  if (idea) out.push({ kind: 'insight', idea: idea.idea, share: pct(idea.share_of_events),
    text: `${cap(idea.idea)} shows up in ${pct(idea.share_of_events)} of your moments.` });
  const roll = new Map(r.palette.map((c) => [c.hex, c.name]));
  const brand = new Map(k.palette.map((c) => [c.hex, c.name]));
  const cols = (item.colors || []).map((h) => String(h).toLowerCase()).map((hex) => (roll.has(hex)
    ? { hex, name: roll.get(hex), from: 'your roll', label: 'from your roll' }
    : { hex, name: brand.get(hex) || hex, from: 'creator', label: `from ${k.name}'s palette` }));
  if (cols.length) out.push({ kind: 'colour', colors: cols, text: cols.map((c) => `${cap(c.name)} ${c.label}`).join('; ') + '.' });
  else {
    const low = (item.brief || '').toLowerCase();
    const metal = ((t.slots || {}).metal || []).find((m) => low.includes(m.toLowerCase()));
    out.push({ kind: 'colour', colors: [], text: `${metal ? cap(metal) : 'Metal'} only: jewelry carries no print colours.` });
  }
  const el = t.required_brand_element.find((e) => (item.brief || '').toLowerCase().includes(e.toLowerCase()));
  if (el) out.push({ kind: 'style', element: el, text: `${cap(el)} comes from ${k.name}'s style.` });
  const want = PLACES[t.category] || [];
  const place = (r.places || []).find((p) => want.includes(p.type));
  out.push(place
    ? { kind: 'product', place: place.type, text: `A ${t.category} for the ${place.type}, where ${pct(place.share_of_events)} of your moments happen.` }
    : { kind: 'product', place: null, text: `A ${t.category} from ${k.name}'s collection, worn rather than placed.` });
  return out;
}

const itemIdFor = (uid, creatorId, templateId) => arcade.rid(uid, creatorId, templateId);
const ownerView = (pub, priv) => ({ itemId: pub.itemId, category: pub.category, status: pub.status, title: pub.title || null,
  description: pub.description || null, maker: pub.maker || null, imageUrl: pub.imageUrl || null, price: pub.price || null,
  why: ((priv || {}).owner_only || {}).why || null, reasons: ((priv || {}).owner_only || {}).reasons || [], reason: pub.reason || null });

async function loadCreator(db, creatorId) {
  if (!ID.test(creatorId || '')) fail('invalid-argument', 'creatorId missing');
  const c = db.collection('creators').doc(creatorId);
  const [ps, vs] = await Promise.all([c.get(), c.collection('private').doc('assets').get()]);
  if (!ps.exists || !vs.exists) fail('not-found', 'no such creator');
  const pub = ps.data(), priv = vs.data();
  return { pub, priv, k: { ...pub, assets: priv.assets || [], templates: priv.templates || [] } };
}

// POST /suggest {creatorId, count?=4}: one item per kit template (first `count`), each final before we answer
async function suggest(db, uid, data = {}, { arc, plan = planItem, faults = {} } = {}) {   // faults: tests only (mock X-Mock-Fault per templateId)
  const { pub, priv, k } = await loadCreator(db, data.creatorId);
  const ins = await db.collection('users').doc(uid).collection('insights').doc('current').get();
  if (!ins.exists) fail('failed-precondition', 'attach a Gold reading first (POST /users/{uid}/insights)');
  const r = ins.data().reading;
  const count = Math.min(Math.max(parseInt(data.count ?? 4, 10) || 4, 1), k.templates.length);
  const maker = priv.owner === uid ? 'creator' : 'fan';
  let cats;
  const categories = () => (cats ||= (arc ||= arcade.client()).call('categories/list', {}).then((x) => x.items));
  const showTag = !(k.rules || {}).public_tag_requires_opt_in || data.showTag === true;

  async function one(t) {
    const itemId = itemIdFor(uid, k.creatorId, t.templateId);
    const m = db.collection('marketplace').doc(itemId), o = m.collection('private').doc('owner');
    const [ps, os] = await Promise.all([m.get(), o.get()]);
    const prev = ps.exists ? ps.data() : null;
    if (prev && prev.status === 'listed') return ownerView(prev, os.exists ? os.data() : null);   // idempotent rerun
    const attempts = prev ? (prev.attempts || 0) + (prev.status === 'not_makeable' ? 1 : 0) : 0;
    const base = { itemId, creatorId: k.creatorId, creatorName: k.name, creatorHandle: k.handle || null, templateId: t.templateId,
      category: t.category, world: t.world, maker, title: (prev && prev.title) || null, attempts,
      stats: (prev && prev.stats) || { buys: 0 }, createdAt: (prev && prev.createdAt) || Date.now() };
    await o.set({ makerUid: uid, owner_only: (os.exists && os.data().owner_only) || {} });
    await m.set({ ...base, status: 'generating', reason: null });
    let doc, owner;
    try {
      const { item, model } = await plan(k, t, r);
      const errs = item ? checkItem(item, k, t, r) : ['no plan'];
      if (errs.length) throw new Error(`item rejected: ${errs.join('; ')}`);
      owner = { fan_idea: item.fan_idea, why: item.why_owner ?? null, reasons: buildReasons(item, k, t, r) };
      await o.set({ makerUid: uid, owner_only: owner, public_tag: item.public_tag ?? null });
      const words = (pub.styleWords || []).length ? ` Style: ${pub.styleWords.join(', ')}.` : '';
      const fields = { ...base, title: item.title ?? null, brief: item.brief, colors: item.colors || [], public_tag: showTag ? (item.public_tag ?? null) : null,
        royalty_pct: (k.rules || {}).royalty_pct ?? null, model };
      const cat = pickCat(await categories(), t.category);
      if (!cat) throw new Error(`no Arcade category for ${t.category}`);
      const rec = await arc.design(item.brief + words, cat.categoryId, { requestId: `${itemId}-${attempts}`,
        colors: t.world === 'print' ? item.colors : undefined, referenceIds: refsFor(t, priv), fault: faults[t.templateId] });
      doc = rec.ok ? { ...fields, status: 'listed', reason: null, ...productFields(rec.product) }
        : { ...fields, status: 'not_makeable', reason: rec.reason || 'Arcade could not make this piece' };
    } catch (e) {
      doc = { ...base, status: 'not_makeable', reason: String((e && e.message) || e) };
    }
    await m.set(doc);
    return ownerView(doc, { owner_only: owner || {} });
  }
  const settled = await Promise.allSettled(k.templates.slice(0, count).map(one));
  return { items: settled.map((s, i) => (s.status === 'fulfilled' ? s.value
    : { itemId: itemIdFor(uid, k.creatorId, k.templates[i].templateId), category: k.templates[i].category, status: 'not_makeable',
      title: null, description: null, maker, imageUrl: null, price: null, why: null, reasons: [], reason: String(s.reason && s.reason.message) })) };
}

// GET /suggestions?creatorId=&count=3: the caller's items so far (deterministic ids -> one getAll; missing skipped)
async function suggestions(db, uid, q = {}) {
  const { k } = await loadCreator(db, q.creatorId);
  const count = Math.min(Math.max(parseInt(q.count ?? 3, 10) || 3, 1), k.templates.length);
  const ms = k.templates.slice(0, count).map((t) => db.collection('marketplace').doc(itemIdFor(uid, k.creatorId, t.templateId)));
  if (!ms.length) return { items: [] };
  const snaps = await db.getAll(...ms, ...ms.map((m) => m.collection('private').doc('owner')));
  const items = [];
  ms.forEach((m, i) => {
    const s = snaps[i], p = snaps[i + ms.length];
    if (s.exists && p.exists && p.data().makerUid === uid) items.push(ownerView(s.data(), p.data()));
  });
  return { items };
}

// ---- universal marketplace (2.9) ----
const STALE_MS = 10 * 60 * 1000;
async function refresh(db, items, arc) {
  const due = items.filter((it) => it.productId && (it.price == null || !it.imageFetchedAt || Date.now() - it.imageFetchedAt > STALE_MS)).slice(0, 12);
  if (!due.length) return;
  let a;
  try { a = arc || arcade.client(); } catch { return; }      // no Arcade configured: keep the stored values
  await Promise.allSettled(due.map(async (it) => {
    const p = await a.call('products/get', { productId: it.productId });
    const upd = { imageUrl: p.imageUrl || it.imageUrl, images: (p.images || []).map((i) => i.url || i).filter(Boolean), price: p.unitPrice || null, imageFetchedAt: Date.now() };
    Object.assign(it, upd);
    await db.collection('marketplace').doc(it.itemId).update(upd);
  }));
}
const feedItem = (it, mine) => { const { brief, model, attempts, ...pub } = it; return { ...pub, stats: { buys: (it.stats || {}).buys || 0 }, mine }; };

// GET /marketplace?sort=new|popular&creatorId=&category=&maker=  (one query; filter + sort in memory)
// ponytail: in-memory filter, add composite indexes past ~1,000 items
async function feed(db, uid, q = {}, { arc } = {}) {
  let xs = (await db.collection('marketplace').where('status', '==', 'listed').get()).docs.map((d) => d.data());
  if (q.creatorId) xs = xs.filter((x) => x.creatorId === q.creatorId);
  if (q.category) xs = xs.filter((x) => x.category === q.category);
  if (q.maker) xs = xs.filter((x) => x.maker === q.maker);
  const popular = q.sort === 'popular';
  xs.sort(popular ? (a, b) => ((b.stats || {}).buys || 0) - ((a.stats || {}).buys || 0) || b.createdAt - a.createdAt : (a, b) => b.createdAt - a.createdAt);
  await refresh(db, xs, arc);
  let mine = xs.map(() => false);
  if (uid && xs.length) {     // ponytail: one batched read per feed; store a makerUid hash on the public doc past ~1,000 items
    const ps = await db.getAll(...xs.map((x) => db.collection('marketplace').doc(x.itemId).collection('private').doc('owner')));
    mine = ps.map((p) => p.exists && p.data().makerUid === uid);
  }
  return { sort: popular ? 'popular' : 'new', items: xs.map((x, i) => feedItem(x, mine[i])) };
}

// GET /creators?q=  (Wishbone Kitchen first; listedCount computed from the one listed query)
const FEATURED = 'creator-wishbonekitchen';
async function listCreators(db, q = {}) {
  const [cs, ls] = await Promise.all([db.collection('creators').get(), db.collection('marketplace').where('status', '==', 'listed').get()]);
  const n = {};
  for (const d of ls.docs) { const c = d.data().creatorId; n[c] = (n[c] || 0) + 1; }
  const needle = String(q.q || '').trim().toLowerCase().replace(/^@/, '');
  let xs = cs.docs.map((d) => d.data()).map((c) => ({ creatorId: c.creatorId, name: c.name, handle: c.handle || null,
    instagram: c.instagram || null, palette: c.palette || [], listedCount: n[c.creatorId] || 0 }));
  if (needle) xs = xs.filter((c) => [c.name, c.handle, c.instagram, c.creatorId].some((v) => String(v || '').toLowerCase().replace(/^@/, '').includes(needle)));
  xs.sort((a, b) => (b.creatorId === FEATURED) - (a.creatorId === FEATURED) || b.listedCount - a.listedCount || String(a.name).localeCompare(String(b.name)));
  return { creators: xs };
}

async function getItem(db, uid, data, { arc } = {}) {
  const m = db.collection('marketplace').doc(data.itemId);
  const [s, p] = await Promise.all([m.get(), m.collection('private').doc('owner').get()]);
  const mine = !!(uid && p.exists && p.data().makerUid === uid);
  if (!s.exists || (s.data().status !== 'listed' && !mine)) fail('not-found', 'no such item');
  const it = s.data();
  if (it.status === 'listed') await refresh(db, [it], arc);
  if (!mine) return { ...it, mine: false };
  const oo = p.data().owner_only || {};
  return { ...it, mine: true, owner_only: oo, owner: { why: oo.why || null, fan_idea: oo.fan_idea || null, reasons: oo.reasons || [] } };
}

async function buy(db, uid, data, { arc } = {}) {
  const quantity = data.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) fail('invalid-argument', 'quantity: an integer 1-20');
  const m = db.collection('marketplace').doc(data.itemId);
  const s = await m.get();
  if (!s.exists || s.data().status !== 'listed') fail('not-found', 'no such listed item');
  const it = s.data();
  if (it.category === 'ring') fail('failed-precondition', 'rings need a size, which a checkout line cannot carry yet');
  // fake products (local simulation) were never made by Arcade: a demo checkout, no Arcade call
  const co = it.fake ? { checkoutId: `demo-${data.itemId}-${((it.stats || {}).buys || 0) + 1}`, checkoutUrl: null, mock: true }
    : await (arc || arcade.client()).call('checkouts/create', { requestId: arcade.rid('buy', uid, data.itemId, quantity, (it.stats || {}).buys || 0),
    lines: [{ productId: it.productId, quantity }], dropShip: quantity === 1 });
  const creatorOwner = ((await db.collection('creators').doc(it.creatorId).collection('private').doc('assets').get()).data() || {}).owner || null;
  const order = db.collection('orders').doc();
  await order.set({ buyer: uid, itemId: data.itemId, creatorId: it.creatorId, storeOwner: creatorOwner, productId: it.productId, quantity,
    checkoutId: co.checkoutId || null, checkoutUrl: co.checkoutUrl, mock: co.mock === true, status: 'checkout_created', createdAt: Date.now() });
  await m.update({ 'stats.buys': FieldValue.increment(1) });
  return { orderId: order.id, checkoutId: co.checkoutId || null, checkoutUrl: co.checkoutUrl, mock: co.mock === true, fake: it.fake === true };
}

module.exports = { validateKit, checkItem, templateFill, planItem, publicKit, userMsg, fixture, SYSTEM, buildReasons, itemIdFor,
  createCreator, getCreator, makeItem, suggest, suggestions, feed, listCreators, getItem, buy };

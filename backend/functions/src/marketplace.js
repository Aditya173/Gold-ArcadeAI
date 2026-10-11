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
  return s.data();
}

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
  const cat = arcade.pick((await arc.call('categories/list', {})).items, t.category);
  const rec = cat ? await arc.design(item.brief, cat.categoryId, { requestId: itemId,
    colors: t.world === 'print' ? item.colors : undefined,
    referenceIds: t.world === 'print' ? t.uses_assets.map((a) => priv.referenceIds[a]).filter(Boolean) : undefined })
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

// ponytail: in-memory sort over the creator's listed items; add orderBy + a composite index when feeds grow
async function feed(db, data) {
  const q = await db.collection('marketplace').where('creatorId', '==', data.creatorId).where('status', '==', 'listed').get();
  const xs = q.docs.map((d) => d.data());
  xs.sort(data.sort === 'popular' ? (a, b) => b.stats.buys - a.stats.buys || b.createdAt - a.createdAt : (a, b) => b.createdAt - a.createdAt);
  return { creatorId: data.creatorId, sort: data.sort === 'popular' ? 'popular' : 'new', items: xs };
}

async function getItem(db, uid, data) {
  const m = db.collection('marketplace').doc(data.itemId);
  const [s, p] = await Promise.all([m.get(), m.collection('private').doc('owner').get()]);
  const mine = uid && p.exists && p.data().makerUid === uid;
  if (!s.exists || (s.data().status !== 'listed' && !mine)) fail('not-found', 'no such item');
  return mine ? { ...s.data(), owner_only: p.data().owner_only } : s.data();
}

async function buy(db, uid, data, { arc = arcade.client() } = {}) {
  const quantity = data.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) fail('invalid-argument', 'quantity: an integer 1-20');
  const m = db.collection('marketplace').doc(data.itemId);
  const s = await m.get();
  if (!s.exists || s.data().status !== 'listed') fail('not-found', 'no such listed item');
  const it = s.data();
  // fake products (local simulation) were never made by Arcade: a demo checkout, no Arcade call
  const co = it.fake ? { checkoutId: `demo-${data.itemId}-${it.stats.buys + 1}`, checkoutUrl: null, mock: true } : await arc.call('checkouts/create', { requestId: arcade.rid('buy', uid, data.itemId, quantity, it.stats.buys),
    lines: [{ productId: it.productId, quantity }], dropShip: quantity === 1 });
  const creatorOwner = ((await db.collection('creators').doc(it.creatorId).collection('private').doc('assets').get()).data() || {}).owner || null;
  const order = db.collection('orders').doc();
  await order.set({ buyer: uid, itemId: data.itemId, creatorId: it.creatorId, storeOwner: creatorOwner, productId: it.productId, quantity,
    checkoutId: co.checkoutId, checkoutUrl: co.checkoutUrl, mock: co.mock === true, status: 'checkout_created', createdAt: Date.now() });
  await m.update({ 'stats.buys': FieldValue.increment(1) });
  return { orderId: order.id, checkoutId: co.checkoutId, checkoutUrl: co.checkoutUrl, mock: co.mock === true, fake: it.fake === true };
}

module.exports = { validateKit, checkItem, templateFill, planItem, publicKit, userMsg, fixture, SYSTEM,
  createCreator, getCreator, makeItem, feed, getItem, buy };

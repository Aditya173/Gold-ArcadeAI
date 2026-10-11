// The store pipeline: attach insights -> create store -> plan -> design -> publish -> checkout (+ delete).
// Each step takes db so the emulator test drives exactly what the deployed API runs.
//   insights  a Gold insight pack (src/packs.js) attached to the user: the demo's ONLY source of readings
//   store     snapshots the user's attached reading into stores/{id}
//   plan      reading -> store + one piece per category (src/planner.js: planner/planner.py's rules, in JS)
//   design    each piece -> Arcade patterns/create (the mock until the hackathon)
//   publish   copies opted-in public fields to public/{id}: no owner uid, no reading, no evidence
// Evidence (the reading's evidence refs) lives ONLY in stores/{id}/private/evidence; stores/** is owner-only in
// firestore.rules and only public/** is world-readable.
const packs = require('./packs');
const planner = require('./planner');
const arcade = require('./arcade');

class HttpsishError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const fail = (code, msg) => { throw new HttpsishError(code, msg); };

async function ownStore(db, uid, storeId) {
  const ref = db.collection('stores').doc(storeId);
  const snap = await ref.get();
  if (!snap.exists || snap.data().owner !== uid) fail('permission-denied', 'not your store');
  return { ref, s: snap.data() };
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;

// role ('creator' | 'fan') goes on users/{uid} so the UI can restore the session (S0) after a reload
async function attachInsights(db, uid, data) {
  const hit = packs.load((data || {}).pack);
  if (!hit) fail('invalid-argument', 'unknown pack (GET /packs lists them)');
  const role = data.role;
  if (role != null && !['creator', 'fan'].includes(role)) fail('invalid-argument', "role: 'creator' or 'fan'");
  const doc = { pack: data.pack, kind: hit.kind, reading: hit.reading, attachedAt: Date.now() };
  const user = db.collection('users').doc(uid);
  await user.collection('insights').doc('current').set(doc);
  if (role) await user.set({ role }, { merge: true });
  return { ...doc, role: role || null };
}

async function getInsights(db, uid) {
  const user = db.collection('users').doc(uid);
  const [s, u] = await Promise.all([user.collection('insights').doc('current').get(), user.get()]);
  if (!s.exists) fail('not-found', 'no insights attached (POST /users/{uid}/insights)');
  const { role = null, creatorId = null } = u.exists ? u.data() : {};
  return { ...s.data(), role, creatorId };
}

// creatorId / templateId: reserved for the brand-template marketplace (creators/{id}, marketplace/{id}); null for now
async function createStore(db, uid, data = {}) {
  const storeId = data.storeId || db.collection('stores').doc().id;
  if (!ID.test(storeId)) fail('invalid-argument', 'storeId: 1-64 of A-Z a-z 0-9 _ -');
  const ref = db.collection('stores').doc(storeId);
  const prev = await ref.get();
  if (prev.exists && prev.data().owner !== uid) fail('permission-denied', 'not your store');
  const ins = await getInsights(db, uid);
  if (prev.exists) {   // re-creating starts over: no stale pieces, and the old public page comes down
    await db.recursiveDelete(ref.collection('products'));
    await db.recursiveDelete(db.collection('public').doc(storeId));
  }
  const r = ins.reading;
  // the reading's evidence refs are owner-only: they go to private/evidence, never on the store doc
  const reading = { ...r, signature: r.signature.map(({ evidence, ...rest }) => rest) };
  await ref.set({ owner: uid, creatorId: null, templateId: null, pack: ins.pack, status: 'created', reading, createdAt: Date.now() });
  await ref.collection('private').doc('evidence').set({ signature: Object.fromEntries(r.signature.map((s) => [s.idea, s.evidence])) });
  return { storeId, status: 'created', pack: ins.pack };
}

async function getStore(db, uid, data) {
  const { ref, s } = await ownStore(db, uid, data.storeId);
  const products = (await ref.collection('products').orderBy('line').get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const evidence = (await ref.collection('private').doc('evidence').get()).data() || {};
  return { storeId: data.storeId, ...s, products, evidence };
}

async function getPublic(db, data) {
  const pub = db.collection('public').doc(data.storeId);
  const s = await pub.get();
  if (!s.exists) fail('not-found', 'no such public store');
  const products = (await pub.collection('products').orderBy('line').get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  return { storeId: data.storeId, ...s.data(), products };
}

async function plan(db, uid, data, { plan: planFn = planner.plan } = {}) {
  const { ref, s } = await ownStore(db, uid, data.storeId);
  let p;
  try { p = await planFn(s.reading); } catch (e) { if (e.code) fail(e.code, e.message); throw e; }
  const ev = (await ref.collection('private').doc('evidence').get()).data() || {};
  const productEvidence = {};
  const batch = db.batch();
  p.products.forEach((x, i) => {
    const pid = `p${String(i).padStart(2, '0')}`;
    productEvidence[pid] = [...new Set((x.signature || []).flatMap((idea) => (ev.signature || {})[idea] || []))];
    batch.set(ref.collection('products').doc(pid), { line: i, category: x.category, title: x.title, prompt: x.prompt,
      colors: x.colors || [], why: x.why, signature: x.signature || [], status: 'planned' });
  });
  batch.set(ref.collection('private').doc('evidence'), { products: productEvidence }, { merge: true });
  batch.update(ref, { status: 'planned', store: p.store, model: p._model || null });
  await batch.commit();
  return { products: p.products.length, model: p._model || null };
}

async function design(db, uid, data, { arc = arcade.client() } = {}) {
  const { ref } = await ownStore(db, uid, data.storeId);
  const faults = data.faults || {};          // mock fault drill {line: 'job_fail' | ...}; arcade.js drops it off localhost
  const cats = (await arc.call('categories/list', {})).items;
  const docs = (await ref.collection('products').orderBy('line').get()).docs.filter((d) => d.data().status === 'planned');
  const done = [];
  for (const d of docs) {                    // resumable: designed/declined products are skipped on a rerun
    const x = d.data();
    const cat = arcade.pick(cats, x.category);
    const rec = cat ? await arc.design(x.prompt, cat.categoryId, { colors: cat.world === 'print' ? x.colors : undefined,
      requestId: arcade.rid(data.storeId, x.line, x.prompt), fault: faults[x.line] }) : { ok: false, stage: 'category', reason: `no category for ${x.category}` };
    if (rec.ok) {
      const pr = rec.product;
      await d.ref.update({ status: 'designed', arcade: { productId: pr.productId, patternId: rec.patternId,
        imageUrl: pr.imageUrl, unitPrice: pr.unitPrice || null, maker: (pr.maker || {}).name || null, categoryId: cat.categoryId } });
    } else {
      await d.ref.update({ status: 'declined', declineReason: `${rec.stage}: ${rec.reason}` });
    }
    done.push({ line: x.line, ok: rec.ok, reason: rec.reason || null });
  }
  await ref.update({ status: 'designed' });
  return { designs: done };
}

// optin: { about: bool, whys: [pid, ...] } -- nothing goes public that the owner did not tick (whys default off).
async function publish(db, uid, data) {
  const { ref, s } = await ownStore(db, uid, data.storeId);
  const optin = data.optin || {}, whys = new Set(optin.whys || []);
  const live = (await ref.collection('products').where('status', '==', 'designed').get()).docs;
  if (!live.length) fail('failed-precondition', 'no designed piece to publish');
  const pub = db.collection('public').doc(data.storeId);
  const batch = db.batch();
  (await pub.collection('products').get()).docs.forEach((d) => batch.delete(d.ref));
  const st = s.store || {};
  batch.set(pub, { name: st.name || 'Store', tagline: st.tagline || '', about: optin.about ? st.about || null : null,
    palette: st.palette || s.reading.palette.map((c) => c.hex), stub: s.reading.stub === true, mock: true, publishedAt: Date.now() });
  for (const d of live) {
    const x = d.data();
    batch.set(pub.collection('products').doc(d.id), { line: x.line, category: x.category, title: x.title,
      why: whys.has(d.id) ? x.why : null, prompt: x.prompt, productId: x.arcade.productId,
      imageUrl: x.arcade.imageUrl, unitPrice: x.arcade.unitPrice, maker: x.arcade.maker });
  }
  batch.update(ref, { status: 'published', publishedAt: Date.now(), optin: { about: !!optin.about, whys: [...whys] } });
  await batch.commit();
  return { storeId: data.storeId, url: `/store/${data.storeId}` };
}

async function checkout(db, uid, data, { arc = arcade.client() } = {}) {
  const pub = db.collection('public').doc(data.storeId);
  if (!(await pub.get()).exists) fail('not-found', 'no such store');
  const p = await pub.collection('products').doc(data.pid).get();
  if (!p.exists) fail('not-found', 'no such piece');
  if (p.data().category === 'ring') fail('failed-precondition', 'rings need a size, and the order line carries none yet');
  const owner = (await db.collection('stores').doc(data.storeId).get()).data().owner;
  const co = await arc.call('checkouts/create', { requestId: arcade.rid('checkout', uid, data.storeId, data.pid),
    lines: [{ productId: p.data().productId, quantity: 1 }], dropShip: true });
  const order = db.collection('orders').doc();
  await order.set({ buyer: uid, storeId: data.storeId, storeOwner: owner, pid: data.pid,
    productId: p.data().productId, checkoutId: co.checkoutId, checkoutUrl: co.checkoutUrl,
    mock: co.mock === true, status: 'checkout_created', createdAt: Date.now() });
  return { orderId: order.id, checkoutUrl: co.checkoutUrl, mock: co.mock === true };
}

// Deletes the store and its public copy. Orders stay (the buyer's record too).
async function deleteStore(db, uid, data) {
  const { ref } = await ownStore(db, uid, data.storeId);
  await db.recursiveDelete(db.collection('public').doc(data.storeId));
  await db.recursiveDelete(ref);
  return { deleted: data.storeId };
}

module.exports = { attachInsights, getInsights, createStore, getStore, getPublic, plan, design, publish, checkout, deleteStore, HttpsishError };

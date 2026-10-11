// The whole API in the emulators against the MOCK Arcade, called over HTTP exactly as the UI will (API.md):
// list packs -> attach a pack -> create store -> plan -> design (one mock maker refusal) -> publish -> a signed-out
// visitor and another user read the public store (no owner, no reading, no evidence, only opted-in whys) -> Buy ->
// mock checkoutUrl -> errors -> delete. Then the brand-template marketplace: creator kit -> 3 fans' items -> feed -> buy.
// Run: python ../arcade/mock_arcade.py --serve 8787   then   npm run e2e
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from 'firebase/firestore';
import assert from 'assert';

const API = process.env.API_BASE || 'http://127.0.0.1:5001/demo-storefront/us-central1/api';
const app = initializeApp({ projectId: 'demo-storefront', apiKey: 'demo-key' });
const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
const log = (...a) => console.log('[e2e]', ...a);

async function api(method, path, body, { token, status = 200 } = {}) {
  const res = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await res.json();
  assert.strictEqual(res.status, status, `${method} ${path}: ${res.status} ${JSON.stringify(json)}`);
  return json;
}
const denied = (p) => p.then(() => false, (e) => /permission/i.test(String(e.code || e.message)));

const { packs } = await api('GET', '/packs');
assert.strictEqual(packs.filter((p) => p.kind === 'archetype').length, 9);
log(`packs: ${packs.length} (${packs.filter((p) => p.kind === 'archetype').length} archetypes)`);

const owner = (await signInAnonymously(auth)).user;
const T = await owner.getIdToken();
await api('POST', '/stores', {}, { status: 401 });
await api('POST', '/stores', {}, { token: T, status: 404 });                 // no insights yet
await api('POST', `/users/${owner.uid}/insights`, { pack: 'nope' }, { token: T, status: 400 });
await api('POST', '/users/someone-else/insights', { pack: 'creator_maya' }, { token: T, status: 403 });

for (const pack of ['archetype-grid-keeper', 'creator_maya']) {
  const ins = await api('POST', `/users/${owner.uid}/insights`, { pack }, { token: T });
  assert.strictEqual(ins.reading.stub, true);
  const { storeId } = await api('POST', '/stores', {}, { token: T });
  const pl = await api('POST', `/stores/${storeId}/plan`, {}, { token: T });
  assert.deepStrictEqual(pl, { products: 6, model: pack === 'creator_maya' ? 'recorded' : 'template' });
  const d = await api('POST', `/stores/${storeId}/design`, { faults: { 0: 'job_fail' } }, { token: T });   // line 0 (the ring): no maker
  assert.ok(!d.designs[0].ok && d.designs.slice(1).every((x) => x.ok), JSON.stringify(d));
  const mine = await api('GET', `/stores/${storeId}`, undefined, { token: T });
  assert.ok(mine.reading.signature.every((s) => !('evidence' in s)) && Object.keys(mine.evidence.signature).length, 'evidence only in private/evidence');
  assert.strictEqual(mine.creatorId, null);
  const live = mine.products.filter((p) => p.status === 'designed').map((p) => p.id);
  const optWhys = live.slice(0, -1);       // the last piece's why stays private
  const pub0 = await api('POST', `/stores/${storeId}/publish`, { optin: { about: true, whys: optWhys } }, { token: T });
  assert.strictEqual(pub0.url, `/store/${storeId}`);
  log(`${pack}: store ${storeId} "${mine.store.name}", ${live.length}/6 designed, published`);

  const pub = await api('GET', `/public/${storeId}`);
  const text = JSON.stringify(pub);
  assert.ok(!text.includes(owner.uid) && !/ev-\d/.test(text) && !('reading' in pub), 'public copy: no owner uid, reading or evidence ref');
  assert.deepStrictEqual(pub.products.map((p) => p.id), live, 'only designed pieces are public');
  assert.ok(pub.products.every((p) => (p.why !== null) === optWhys.includes(p.id)), 'only opted-in whys are public');

  await signOut(auth);
  const buyer = (await signInAnonymously(auth)).user;
  const B = await buyer.getIdToken();
  await api('GET', `/stores/${storeId}`, undefined, { token: B, status: 403 });
  assert.ok(await denied(getDoc(doc(db, 'stores', storeId, 'private', 'evidence'))), 'another user cannot read evidence');
  const ring = pub.products.find((p) => p.category === 'ring');
  if (ring) await api('POST', `/public/${storeId}/products/${ring.id}/checkout`, {}, { token: B, status: 409 });
  const target = pub.products.find((p) => p.category !== 'ring');
  const co = await api('POST', `/public/${storeId}/products/${target.id}/checkout`, {}, { token: B });
  assert.ok(co.mock === true && co.checkoutUrl.includes('/mock/checkout/'), 'mock checkoutUrl');
  const order = (await getDoc(doc(db, 'orders', co.orderId))).data();
  assert.deepStrictEqual([order.buyer, order.storeOwner], [buyer.uid, owner.uid]);
  await api('DELETE', `/stores/${storeId}`, undefined, { token: B, status: 403 });
  log(`buyer: mock checkout ${co.checkoutUrl}`);
  await signOut(auth);
  if (pack === 'creator_maya') {      // the owner deletes (an ID token stays valid after the client signs out)
    await api('DELETE', `/stores/${storeId}`, undefined, { token: T });
    await api('GET', `/public/${storeId}`, undefined, { status: 404 });
    log('owner deleted the store; public page gone');
  }
}
// ---- the brand-template marketplace: a creator's kit + 3 fans' insight packs -> 3 listed pieces
const user = async () => { await signOut(auth); const u = (await signInAnonymously(auth)).user; return { uid: u.uid, token: await u.getIdToken() }; };
const creator = await user();
await api('POST', '/creators', { fixture: 'nope' }, { token: creator.token, status: 400 });
await api('POST', '/creators', { schema: 'brand.kit.v0', creatorId: 'x', name: 'X', palette: [], templates: [] }, { token: creator.token, status: 400 });
const made = await api('POST', '/creators', { fixture: 'brand_tide_and_clay' }, { token: creator.token });
assert.deepStrictEqual(made, { creatorId: 'creator-tide-and-clay', assets: 3 });
const CID = made.creatorId;
const kitPub = await api('GET', `/creators/${CID}`);
assert.ok(kitPub.name === 'Tide & Clay' && !/referenceId|byteLength|owner/.test(JSON.stringify(kitPub)), 'public kit: no asset internals, no owner');
const fans = [];
for (const [pack, templateId] of [['archetype-first-light-solitary', 'tc-print'], ['archetype-small-table-host', 'tc-pillow'], ['archetype-night-shift-builder', 'tc-pendant']]) {
  const f = await user();
  await api('POST', `/creators/${CID}/items`, { templateId }, { token: f.token, status: 409 });     // no insights yet
  await api('POST', `/users/${f.uid}/insights`, { pack }, { token: f.token });
  const it = await api('POST', `/creators/${CID}/items`, { templateId, showTag: true }, { token: f.token });
  assert.ok(it.status === 'listed' && it.model === 'recorded' && it.owner_only.why, JSON.stringify(it));
  fans.push({ ...f, itemId: it.itemId, why: it.owner_only.why });
  log(`fan (${pack}) -> ${it.category}: "${it.title}" ${it.status}, ${it.price.amount} ${it.price.currency} (mock), tag "${it.public_tag}"`);
}
await api('POST', `/creators/${CID}/items`, { templateId: 'nope' }, { token: fans[0].token, status: 400 });
const feedNew = await api('GET', `/creators/${CID}/marketplace?sort=new`);
assert.strictEqual(feedNew.items.length, 3);
assert.deepStrictEqual(feedNew.items.map((i) => i.itemId), fans.map((f) => f.itemId).reverse(), 'newest first');
const feedText = JSON.stringify(feedNew);
assert.ok(!/owner_only|makerUid|fan_idea|why/.test(feedText) && fans.every((f) => !feedText.includes(f.uid) && !feedText.includes(f.why)), 'feed: no owner_only, no maker uid');
const mineView = await api('GET', `/marketplace/${fans[0].itemId}`, undefined, { token: fans[0].token });
assert.strictEqual(mineView.owner_only.why, fans[0].why, 'the maker sees their own owner_only');
const otherView = await api('GET', `/marketplace/${fans[0].itemId}`, undefined, { token: fans[1].token });
assert.ok(!('owner_only' in otherView) && !JSON.stringify(otherView).includes(fans[0].why), 'another fan does not');
assert.ok(!('owner_only' in await api('GET', `/marketplace/${fans[0].itemId}`)), 'nor does a signed-out visitor');
await signOut(auth);
await signInAnonymously(auth);                                                  // a client as fans[1] would be: rules check
assert.ok(await denied(getDoc(doc(db, 'marketplace', fans[0].itemId, 'private', 'owner'))), 'rules: a non-maker cannot read private/owner');
await api('POST', `/marketplace/${fans[0].itemId}/buy`, { quantity: 1 }, { status: 401 });
await api('POST', `/marketplace/${fans[0].itemId}/buy`, { quantity: 0 }, { token: fans[1].token, status: 400 });
const bought = await api('POST', `/marketplace/${fans[0].itemId}/buy`, { quantity: 1 }, { token: fans[1].token });
assert.ok(bought.mock === true && bought.checkoutUrl.includes('/mock/checkout/'), 'mock checkoutUrl');
assert.strictEqual((await api('GET', `/marketplace/${fans[0].itemId}`)).stats.buys, 1);
assert.strictEqual((await api('GET', `/creators/${CID}/marketplace?sort=popular`)).items[0].itemId, fans[0].itemId, 'popular: most bought first');
log(`marketplace ${kitPub.name}: 3 listed, owner_only private, bought -> ${bought.checkoutUrl}, buys=1`);

await api('GET', '/nope', undefined, { status: 404 });
log('PASS');
process.exit(0);

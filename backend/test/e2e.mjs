// The marketplace flow (BRIEF_MARKETPLACE.md 2.13) in the emulators against the MOCK Arcade, over HTTP as the app calls it:
// creator (form onboard, unique handle so it also runs against seeded emulators) -> suggest 3 -> a fan (new uid) attaches
// a pack -> suggest 3 -> GET /marketplace has creator + fan items, no owner-only fields -> signed-out buy 401 -> buy -> buys 1.
// Run: python ../arcade/mock_arcade.py --serve 8787   then   npm run e2e   (or node test/e2e.mjs with emulators up)
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
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
const user = async () => { await signOut(auth); const u = (await signInAnonymously(auth)).user; return { uid: u.uid, token: await u.getIdToken() }; };
const png = (name) => readFileSync(new URL(`../../marketplace/fixtures/images/${name}.png`, import.meta.url)).toString('base64');

const { packs } = await api('GET', '/packs');
assert.strictEqual(packs.filter((p) => p.kind === 'archetype').length, 9);
log(`packs: ${packs.length} (${packs.filter((p) => p.kind === 'archetype').length} archetypes)`);

// creator
const c = await user();
await api('POST', '/creators/onboard', { fixture: 'brand_wishbonekitchen' }, { status: 401 });
await api('POST', `/users/${c.uid}/insights`, { pack: 'archetype-small-table-host', role: 'creator' }, { token: c.token });
const handle = `e2e-${Date.now().toString(36)}`;
const form = { name: 'E2E Kitchen', handle, instagram: '@e2e.kitchen', palette: ['#1F3A5F', '#F2E8D5', '#D96C3B'], styleWords: ['gingham', 'citrus'],
  images: ['logo', 'pattern-gingham', 'pattern-citrus'].map((n, i) => ({ kind: i ? 'reference' : 'logo', mediaType: 'image/png', dataBase64: png(n) })) };
await api('POST', '/creators/onboard', { ...form, palette: ['nope'] }, { token: c.token, status: 400 });
const ob = await api('POST', '/creators/onboard', form, { token: c.token });
const CID = ob.creatorId;
assert.strictEqual(CID, `creator-${handle}`);
assert.ok(ob.style.images.every((i) => i.status === 'ready') && ob.style.styleRefs.length <= 3, JSON.stringify(ob));
const ins = await api('GET', `/users/${c.uid}/insights`, undefined, { token: c.token });
assert.deepStrictEqual([ins.role, ins.creatorId], ['creator', CID]);
const cs = (await api('POST', '/suggest', { creatorId: CID, count: 3 }, { token: c.token })).items;
assert.ok(cs.length === 3 && cs.every((i) => i.maker === 'creator' && ['listed', 'not_makeable'].includes(i.status)), JSON.stringify(cs));
log(`creator ${CID}: ${cs.map((i) => `${i.category} ${i.status}`).join(', ')}`);

// fan
const f = await user();
await api('POST', '/suggest', { creatorId: CID, count: 3 }, { token: f.token, status: 409 });     // no reading yet
await api('POST', '/suggest', { creatorId: 'creator-nope', count: 3 }, { token: f.token, status: 404 });
await api('POST', `/users/${f.uid}/insights`, { pack: 'archetype-two-gear-day', role: 'fan' }, { token: f.token });
const fs = (await api('POST', '/suggest', { creatorId: CID, count: 3 }, { token: f.token })).items;
assert.ok(fs.length === 3 && fs.every((i) => i.maker === 'fan'), JSON.stringify(fs));
const again = (await api('GET', `/suggestions?creatorId=${CID}&count=3`, undefined, { token: f.token })).items;
assert.deepStrictEqual(again.map((i) => i.itemId).sort(), fs.map((i) => i.itemId).sort(), 'suggestions = the same deterministic items');
log(`fan: ${fs.map((i) => `${i.category} ${i.status}`).join(', ')}`);

// the universal feed
const feed = (await api('GET', `/marketplace?creatorId=${CID}`)).items;
assert.ok(feed.some((i) => i.maker === 'creator') && feed.some((i) => i.maker === 'fan'), 'feed has creator + fan items');
const text = JSON.stringify(feed);
assert.ok(!/owner_only|makerUid|fan_idea|reasons/.test(text) && !text.includes(f.uid) && !text.includes(c.uid), 'feed: nothing owner-only');
const mine = (await api('GET', `/marketplace?creatorId=${CID}&maker=fan`, undefined, { token: f.token })).items;
assert.ok(mine.length && mine.every((i) => i.mine && i.maker === 'fan'), 'maker filter + mine');
const all = (await api('GET', '/marketplace')).items;
assert.ok(all.length >= feed.length);

// buy
const target = feed.find((i) => i.maker === 'fan' && i.category !== 'ring') || feed[0];
const b = await user();
assert.ok(await denied(getDoc(doc(db, 'marketplace', target.itemId, 'private', 'owner'))), 'rules: a non-maker cannot read private/owner');
await api('POST', `/marketplace/${target.itemId}/buy`, { quantity: 1 }, { status: 401 });         // signed out
const bought = await api('POST', `/marketplace/${target.itemId}/buy`, { quantity: 1 }, { token: b.token });
assert.ok(bought.mock === true && bought.checkoutUrl.includes('/mock/checkout/') && bought.orderId, JSON.stringify(bought));
assert.strictEqual((await api('GET', `/marketplace/${target.itemId}`)).stats.buys, 1);
log(`bought ${target.itemId} -> ${bought.checkoutUrl}, buys=1; feed ${all.length} listed`);

await api('GET', '/nope', undefined, { status: 404 });
log('PASS');
process.exit(0);

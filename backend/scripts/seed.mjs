// Seed the emulator with the demo marketplace (BRIEF_MARKETPLACE.md 2.11): Wishbone Kitchen + its 4 products, and
// 2 fans' items. Idempotent: fixed seed uids (unsigned custom tokens, which only the Auth emulator accepts), so
// itemIds and Arcade requestIds are the same on every run and listed items are skipped.
// Run (emulators + mock Arcade up): node scripts/seed.mjs [--fans-only]
const API = process.env.API_BASE || 'http://127.0.0.1:5001/demo-storefront/us-central1/api';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const CID = 'creator-wishbonekitchen';
const fansOnly = process.argv.includes('--fans-only');

async function token(uid) {      // emulator only: it accepts an alg "none" custom token
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const custom = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ uid, iat: now, exp: now + 3600,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iss: 'seed@demo-storefront.iam.gserviceaccount.com', sub: 'seed@demo-storefront.iam.gserviceaccount.com' })}.`;
  const r = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) });
  const j = await r.json();
  if (!j.idToken) throw new Error(`auth emulator sign-in for ${uid}: ${JSON.stringify(j)}`);
  return j.idToken;
}
async function api(method, path, body, tok) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${JSON.stringify(j)}`);
  return j;
}
const show = (who, items) => items.forEach((i) => console.log(`[seed] ${who}: ${i.category} "${i.title}" ${i.status}${i.reason ? ` (${i.reason})` : ''}`));

const users = [
  ...(fansOnly ? [] : [{ uid: 'seed-creator-wishbonekitchen', pack: 'archetype-small-table-host', role: 'creator', count: 4 }]),
  { uid: 'seed-fan-1', pack: 'archetype-two-gear-day', role: 'fan', count: 1 },
  { uid: 'seed-fan-2', pack: 'archetype-same-order-regular', role: 'fan', count: 1 },
];
for (const u of users) {
  const t = await token(u.uid);
  await api('POST', `/users/${u.uid}/insights`, { pack: u.pack, role: u.role }, t);
  if (u.role === 'creator') console.log(`[seed] onboard ${(await api('POST', '/creators/onboard', { fixture: 'brand_wishbonekitchen' }, t)).creatorId}`);
  show(`${u.role} (${u.pack})`, (await api('POST', '/suggest', { creatorId: CID, count: u.count }, t)).items);
}
const { items } = await api('GET', '/marketplace');
console.log(`[seed] GET /marketplace: ${items.length} listed`);
if (items.length < 5) { console.error('[seed] FAIL: fewer than 5 listed items'); process.exit(1); }

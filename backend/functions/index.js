// One HTTP function, `api`: a small JSON router around src/flow.js. Contract: ../API.md.
// Auth: `Authorization: Bearer <Firebase ID token>` (anonymous sign-in is fine). The GET routes for packs, public
// stores, creators, feeds and items are open.
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const flow = require('./src/flow');
const packs = require('./src/packs');
const market = require('./src/marketplace');
const ig = require('./src/instagram');
const fakes = require('./src/fakes');
const { ArcadeError } = require('./src/arcade');

admin.initializeApp();
const db = () => admin.firestore();

const STATUS = { 'invalid-argument': 400, unauthenticated: 401, 'permission-denied': 403, 'not-found': 404,
  'failed-precondition': 409, unavailable: 503, internal: 500 };

// [method, pattern, auth?, handler(uid, params, body, query)]. Open routes still get the uid when a token is sent.
const ROUTES = [
  ['GET', /^\/packs$/, false, () => ({ packs: packs.list() })],
  ['POST', /^\/users\/([^/]+)\/insights$/, true, (uid, [u], b) => (u === uid ? flow.attachInsights(db(), uid, b) : deny())],
  ['GET', /^\/users\/([^/]+)\/insights$/, true, (uid, [u]) => (u === uid ? flow.getInsights(db(), uid) : deny())],
  ['POST', /^\/stores$/, true, (uid, _, b) => flow.createStore(db(), uid, b)],
  ['GET', /^\/stores\/([^/]+)$/, true, (uid, [storeId]) => flow.getStore(db(), uid, { storeId })],
  ['DELETE', /^\/stores\/([^/]+)$/, true, (uid, [storeId]) => flow.deleteStore(db(), uid, { storeId })],
  ['POST', /^\/stores\/([^/]+)\/plan$/, true, (uid, [storeId]) => flow.plan(db(), uid, { storeId })],
  ['POST', /^\/stores\/([^/]+)\/design$/, true, (uid, [storeId], b) => flow.design(db(), uid, { ...b, storeId })],
  ['POST', /^\/stores\/([^/]+)\/publish$/, true, (uid, [storeId], b) => flow.publish(db(), uid, { ...b, storeId })],
  ['GET', /^\/public\/([^/]+)$/, false, (uid, [storeId]) => flow.getPublic(db(), { storeId })],
  ['POST', /^\/public\/([^/]+)\/products\/([^/]+)\/checkout$/, true, (uid, [storeId, pid]) => flow.checkout(db(), uid, { storeId, pid })],
  // the brand-template marketplace (idea 7)
  ['POST', /^\/instagram\/scrape$/, true, (uid, _, b) => ig.scrape(uid, b)],
  // local simulation only: load marketplace/fixtures/fake_products/products.json into the emulator
  ['POST', /^\/dev\/fake-products$/, false, () => (process.env.FUNCTIONS_EMULATOR === 'true' ? fakes.loadFakes(db())
    : (() => { throw new flow.HttpsishError('permission-denied', 'emulator only'); })())],
  ['POST', /^\/creators$/, true, (uid, _, b) => market.createCreator(db(), uid, b)],
  ['GET', /^\/creators\/([^/]+)$/, false, (uid, [creatorId]) => market.getCreator(db(), { creatorId })],
  ['POST', /^\/creators\/([^/]+)\/items$/, true, (uid, [creatorId], b) => market.makeItem(db(), uid, { ...b, creatorId })],
  ['GET', /^\/creators\/([^/]+)\/marketplace$/, false, (uid, [creatorId], b, q) => market.feed(db(), { creatorId, sort: q.sort })],
  ['GET', /^\/marketplace\/([^/]+)$/, false, (uid, [itemId]) => market.getItem(db(), uid, { itemId })],
  ['POST', /^\/marketplace\/([^/]+)\/buy$/, true, (uid, [itemId], b) => market.buy(db(), uid, { ...b, itemId })],
];
const deny = () => { throw new flow.HttpsishError('permission-denied', 'you can only act on your own user'); };

async function uidOf(req) {
  const m = /^Bearer (.+)$/.exec(req.get('authorization') || '');
  if (!m) return null;
  try { return (await admin.auth().verifyIdToken(m[1])).uid; } catch { return null; }
}

exports.api = onRequest({ cors: true, timeoutSeconds: 300, memory: '512MiB' }, async (req, res) => {
  const send = (code, status, message) => res.status(status).json({ error: { code, message } });
  const asset = /^\/assets\/fake\/([^/]+)$/.exec(req.path);              // images for fake products (relative imageUrl)
  if (asset && req.method === 'GET') {
    const f = fakes.assetPath(decodeURIComponent(asset[1]));
    return f ? res.sendFile(f) : send('not-found', 404, 'no such image');
  }
  const route = ROUTES.map(([method, re, auth, fn]) => ({ method, m: re.exec(req.path), auth, fn })).filter((r) => r.m);
  const hit = route.find((r) => r.method === req.method);
  if (!hit) return route.length ? send('method-not-allowed', 405, `${req.method} ${req.path}`) : send('not-found', 404, `no route ${req.path}`);
  try {
    const uid = await uidOf(req);
    if (hit.auth && !uid) return send('unauthenticated', 401, 'send Authorization: Bearer <Firebase ID token>');
    const params = hit.m.slice(1).map(decodeURIComponent);
    res.json(await hit.fn(uid, params, req.body && typeof req.body === 'object' ? req.body : {}, req.query || {}));
  } catch (e) {
    if (e instanceof flow.HttpsishError) return send(e.code, STATUS[e.code] || 500, e.message);
    console.error(e);
    // Arcade answered with an error, or (mock) is not running
    const code = e instanceof ArcadeError || /fetch failed|ECONNREFUSED/.test(`${e.message} ${e.cause}`) ? 'unavailable' : 'internal';
    send(code, STATUS[code], e.message);
  }
});

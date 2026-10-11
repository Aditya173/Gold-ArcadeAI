// One HTTP function, `api`: a small JSON router. Contract: ../API.md and BRIEF_MARKETPLACE.md 2.4.
// Auth: `Authorization: Bearer <Firebase ID token>` (anonymous sign-in is fine). The GET routes for packs, creators,
// the marketplace feed and items are open (they still get the uid when a token is sent).
// Routes whose module export is not built yet answer 501 (checked before auth).
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const flow = require('./src/flow');
const packs = require('./src/packs');
const fakes = require('./src/fakes');
const { ArcadeError } = require('./src/arcade');

if (!admin.apps.length) admin.initializeApp();
const db = () => admin.firestore();

const STATUS = { 'invalid-argument': 400, unauthenticated: 401, 'permission-denied': 403, 'not-found': 404,
  'failed-precondition': 409, unimplemented: 501, unavailable: 503, internal: 500 };

// a module that may not exist yet (built by another unit): null while missing, so its routes answer 501
function mod(name) {
  try { return require(`./src/${name}`); } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND' && String(e.message).includes(`src/${name}`)) return null;
    throw e;
  }
}
// use('marketplace', 'feed', (f, uid, params, body, query) => f(...)): the handler, plus ready() for the 501 check
function use(modName, fnName, call) {
  const get = () => { const m = mod(modName); return m && typeof m[fnName] === 'function' ? m[fnName] : null; };
  const h = (uid, params, body, query) => call(get(), uid, params, body, query);
  h.ready = () => !!get();
  h.what = `${modName}.${fnName}`;
  return h;
}

// [method, pattern, auth?, handler(uid, params, body, query)]
const ROUTES = [
  ['GET', /^\/packs$/, false, () => ({ packs: packs.list() })],
  ['POST', /^\/users\/([^/]+)\/insights$/, true, (uid, [u], b) => (u === uid ? flow.attachInsights(db(), uid, b) : deny())],
  ['GET', /^\/users\/([^/]+)\/insights$/, true, (uid, [u]) => (u === uid ? flow.getInsights(db(), uid) : deny())],
  // creator onboarding (style) and Instagram
  ['POST', /^\/creators\/onboard$/, true, use('style', 'onboard', (f, uid, _, b) => f(db(), uid, b))],
  ['POST', /^\/instagram\/scrape$/, true, use('instagram', 'scrape', (f, uid, _, b) => f(uid, b))],
  ['GET', /^\/instagram\/connect$/, true, use('instagram', 'connect', (f, uid, _, b, q) => f(db(), uid, q))],
  ['GET', /^\/instagram\/callback$/, false, use('instagram', 'callback', (f, uid, _, b, q) => f(db(), q))],   // auth via signed `state`
  ['GET', /^\/instagram\/status$/, true, use('instagram', 'status', (f, uid) => f(db(), uid))],
  ['GET', /^\/instagram\/media$/, true, use('instagram', 'media', (f, uid, _, b, q) => f(db(), uid, q))],
  // creators, suggestions, the universal marketplace, buy
  ['GET', /^\/creators$/, false, use('marketplace', 'listCreators', (f, uid, _, b, q) => f(db(), q))],
  ['GET', /^\/creators\/([^/]+)$/, false, use('marketplace', 'getCreator', (f, uid, [creatorId]) => f(db(), { creatorId }))],
  ['POST', /^\/suggest$/, true, use('marketplace', 'suggest', (f, uid, _, b) => f(db(), uid, b))],
  ['GET', /^\/suggestions$/, true, use('marketplace', 'suggestions', (f, uid, _, b, q) => f(db(), uid, q))],
  ['GET', /^\/marketplace$/, false, use('marketplace', 'feed', (f, uid, _, b, q) => f(db(), uid, q))],
  ['GET', /^\/marketplace\/([^/]+)$/, false, use('marketplace', 'getItem', (f, uid, [itemId]) => f(db(), uid, { itemId }))],
  ['POST', /^\/marketplace\/([^/]+)\/buy$/, true, use('marketplace', 'buy', (f, uid, [itemId], b) => f(db(), uid, { ...b, itemId }))],
  // local simulation only: load marketplace/fixtures/fake_products/products.json into the emulator
  ['POST', /^\/dev\/fake-products$/, false, () => (process.env.FUNCTIONS_EMULATOR === 'true' ? fakes.loadFakes(db())
    : (() => { throw new flow.HttpsishError('permission-denied', 'emulator only'); })())],
];
const deny = () => { throw new flow.HttpsishError('permission-denied', 'you can only act on your own user'); };

async function uidOf(req) {
  const m = /^Bearer (.+)$/.exec((req.get && req.get('authorization')) || '');
  if (!m) return null;
  try { return (await admin.auth().verifyIdToken(m[1])).uid; } catch { return null; }
}

// plain (req, res) router; exported as `api` below and as api.handle for tests
async function handle(req, res) {
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
    if (hit.fn.ready && !hit.fn.ready()) return send('unimplemented', 501, `${req.method} ${req.path} is not built yet (${hit.fn.what})`);
    const uid = await uidOf(req);
    if (hit.auth && !uid) return send('unauthenticated', 401, 'send Authorization: Bearer <Firebase ID token>');
    const params = hit.m.slice(1).map(decodeURIComponent);
    const out = await hit.fn(uid, params, req.body && typeof req.body === 'object' ? req.body : {}, req.query || {});
    if (out && typeof out.redirect === 'string' && out.redirect) return res.redirect(302, out.redirect);   // the Instagram callback back to the app
    return res.json(out);
  } catch (e) {
    if (e instanceof flow.HttpsishError || (e && e.constructor && e.constructor.name === 'HttpsishError')) return send(e.code, STATUS[e.code] || 500, e.message);
    console.error(e);
    // Arcade answered with an error, or (mock) is not running
    const code = e instanceof ArcadeError || /fetch failed|ECONNREFUSED/.test(`${e.message} ${e.cause}`) ? 'unavailable' : 'internal';
    return send(code, STATUS[code], e.message);
  }
}

exports.api = onRequest({ cors: true, timeoutSeconds: 540, memory: '512MiB' }, handle);
exports.api.handle = handle;

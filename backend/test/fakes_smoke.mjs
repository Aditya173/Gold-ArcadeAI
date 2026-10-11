// Local-simulation smoke test for fake products, over HTTP in the emulators (no Arcade needed):
// load -> feed -> image -> buy. Run: npm run fakes (from backend/).
const API = process.env.API_BASE || 'http://127.0.0.1:5001/demo-storefront/us-central1/api';
const ok = (c, m) => { if (!c) { console.error(`[fakes] FAIL ${m}`); process.exit(1); } };

const anon = await (await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) })).json();
const H = { 'content-type': 'application/json', authorization: `Bearer ${anon.idToken}` };

const load = await (await fetch(`${API}/dev/fake-products`, { method: 'POST' })).json();
ok(load.loaded >= 3, `load ${JSON.stringify(load)}`);
const again = await (await fetch(`${API}/dev/fake-products`, { method: 'POST' })).json();
ok(again.loaded === load.loaded, 'loading twice is safe');

const feed = await (await fetch(`${API}/creators/creator-wishbonekitchen/marketplace?sort=popular`)).json();
ok(feed.items.length >= 3 && feed.items.every((i) => i.fake && i.price.mock), 'feed lists the fakes');
ok(feed.items.some((i) => i.maker === 'fan') && feed.items.some((i) => i.maker === 'creator'), 'creator + fan items');
ok(!JSON.stringify(feed).includes('owner_only') && !JSON.stringify(feed).includes('% of your moments'), 'no private why in the feed');

const img = await fetch(`${API}${feed.items[0].imageUrl}`);
ok(img.status === 200 && (img.headers.get('content-type') || '').startsWith('image/'), `image ${img.status}`);
ok((await fetch(`${API}/assets/fake/..%2F..%2Fpackage.json`)).status === 404, 'no path escape');

const item = feed.items.find((i) => i.maker === 'fan');
const before = item.stats.buys;
const buy = await (await fetch(`${API}/marketplace/${item.itemId}/buy`, { method: 'POST', headers: H, body: JSON.stringify({ quantity: 1 }) })).json();
ok(buy.fake === true && buy.checkoutUrl === null && buy.orderId, `buy ${JSON.stringify(buy)}`);
const after = await (await fetch(`${API}/marketplace/${item.itemId}`)).json();
ok(after.stats.buys === before + 1 && !after.owner_only, 'times bought +1; the private why stays private');
console.log(`[fakes] PASS: ${load.loaded} loaded, feed ${feed.items.length}, image ok, demo checkout ${buy.checkoutId}`);

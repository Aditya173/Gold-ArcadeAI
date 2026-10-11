// Fake products for the local simulation: hand-made listings that fill the marketplace without Arcade.
// Source: <repo>/marketplace/fixtures/fake_products/products.json (+ images/ beside it). Loaded into the emulator by
// POST /dev/fake-products (emulator only). Each becomes marketplace/{itemId} with fake: true, so buy() skips Arcade.
// Format and how to add one: marketplace/fixtures/fake_products/README.md.
const fs = require('fs');
const path = require('path');
const { HttpsishError } = require('./flow');
const M = require('./marketplace');

const DIR = path.join(__dirname, '..', '..', '..', 'marketplace', 'fixtures', 'fake_products');
const IMG = /^[A-Za-z0-9._-]{1,80}\.(jpe?g|png|webp)$/;
const CATEGORIES = ['ring', 'pendant necklace', 'earrings', 'rug', 'throw pillow', 'wall art print', 'textile', 'ceramic plate'];
const HEX = /^#[0-9a-f]{6}$/;
const fail = (code, msg) => { throw new HttpsishError(code, msg); };

function validateFake(p, i = 0) {
  const e = [];
  const at = `products[${i}]${p && p.title ? ` "${p.title}"` : ''}`;
  if (!p || typeof p !== 'object') return [`${at}: not an object`];
  if (p.itemId !== undefined && !/^[a-z0-9-]{3,60}$/.test(p.itemId)) e.push(`${at}: itemId must be a-z 0-9 - (3-60)`);
  if (!/^creator-[a-z0-9-]+$/.test(p.creatorId || '')) e.push(`${at}: creatorId like "creator-wishbonekitchen"`);
  if (!['creator', 'fan'].includes(p.maker)) e.push(`${at}: maker must be "creator" or "fan"`);
  if (!p.title || p.title.length > 60) e.push(`${at}: title 1-60 chars`);
  if (!CATEGORIES.includes(p.category)) e.push(`${at}: category one of ${CATEGORIES.join(', ')}`);
  if (!p.price || !/^\d+\.\d{2}$/.test(p.price.amount || '') || !/^[A-Z]{3}$/.test(p.price.currency || '')) e.push(`${at}: price {amount:"48.00", currency:"USD"}`);
  if (!p.image || !(IMG.test(p.image) || /^https:\/\/\S+$/.test(p.image))) e.push(`${at}: image is a file in images/ (.jpg/.png/.webp) or an https URL`);
  else if (IMG.test(p.image) && !fs.existsSync(path.join(DIR, 'images', p.image))) e.push(`${at}: images/${p.image} not found`);
  if (p.colors && !(Array.isArray(p.colors) && p.colors.every((c) => HEX.test(String(c).toLowerCase())))) e.push(`${at}: colors are #rrggbb`);
  if (p.public_tag && (p.public_tag.split(/\s+/).length > 6 || /\d/.test(p.public_tag))) e.push(`${at}: public_tag <= 6 words, no numbers`);
  if (p.maker === 'creator' && (p.why || p.fan_idea)) e.push(`${at}: why / fan_idea are for fan items only`);
  return e;
}

function readFakes(dir = DIR) {
  const f = path.join(dir, 'products.json');
  if (!fs.existsSync(f)) fail('not-found', 'no marketplace/fixtures/fake_products/products.json');
  const list = JSON.parse(fs.readFileSync(f, 'utf8')).products || [];
  const errs = list.flatMap(validateFake);
  if (errs.length) fail('invalid-argument', errs.join('; '));
  return list;
}

const itemIdOf = (p, i) => p.itemId || `fake-${p.creatorId.replace(/^creator-/, '')}-${i + 1}`;

async function loadFakes(db, list = readFakes()) {
  const creators = {};
  for (const [i, p] of list.entries()) {
    if (!creators[p.creatorId]) {                         // make sure the creator exists (straight from its kit, no Arcade)
      const ref = db.collection('creators').doc(p.creatorId);
      const s = await ref.get();
      if (!s.exists) {
        const k = M.fixture(`brand_${p.creatorId.replace(/^creator-/, '').replace(/-/g, '_')}`);
        if (!k) fail('invalid-argument', `${p.creatorId}: no such creator in the emulator and no brand_*.json fixture for it`);
        await ref.set({ ...M.publicKit(k), createdAt: Date.now(), updatedAt: Date.now(), fake: true });
        await ref.collection('private').doc('assets').set({ owner: `seed-${p.creatorId}`, assets: k.assets || [], referenceIds: {}, templates: k.templates });
      }
      creators[p.creatorId] = (await ref.get()).data().name;
    }
    const itemId = itemIdOf(p, i);
    const m = db.collection('marketplace').doc(itemId);
    const prev = await m.get();
    await m.set({
      itemId, creatorId: p.creatorId, creatorName: creators[p.creatorId], maker: p.maker, templateId: null,
      category: p.category, world: ['ring', 'pendant necklace', 'earrings'].includes(p.category) ? 'jewelry' : 'print',
      title: p.title, description: p.description || '', brief: p.description || '', colors: (p.colors || []).map((c) => c.toLowerCase()),
      public_tag: p.public_tag || null, royalty_pct: null, model: 'fake', status: 'listed', productId: null,
      imageUrl: IMG.test(p.image) ? `/assets/fake/${p.image}` : p.image,   // relative = served by GET /assets/fake/{file}
      price: { amount: p.price.amount, currency: p.price.currency, mock: true },
      stats: prev.exists ? prev.data().stats : { buys: p.buys || 0 }, createdAt: Date.now() - i * 60000, fake: true,
    });
    if (p.maker === 'fan') {
      await m.collection('private').doc('owner').set({ makerUid: `fake-fan-${i + 1}`,
        owner_only: { fan_idea: p.fan_idea || null, why: p.why || null }, public_tag: p.public_tag || null });
    }
  }
  return { loaded: list.length, creators: Object.keys(creators) };
}

// GET /assets/fake/{file}: the image bytes for a relative imageUrl
function assetPath(file) {
  if (!IMG.test(file || '')) return null;
  const f = path.join(DIR, 'images', file);
  return fs.existsSync(f) ? f : null;
}

module.exports = { validateFake, readFakes, loadFakes, assetPath, CATEGORIES };

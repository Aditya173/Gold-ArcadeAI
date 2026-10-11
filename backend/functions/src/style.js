// POST /creators/onboard (brief 2.7): a creator's images -> Arcade references, plus a brand.kit.v0 (contract 2.3).
// The "style" is styleRefs (<=3 referenceIds) + palette + styleWords on the creator; Arcade has no style object.
//   form     {name, handle, instagram, palette:["#rrggbb"..], styleWords?, images:[{kind, mediaType, dataBase64}],
//             instagramMediaIds?, styleRefs?:[i,i,i]}
//   fixture  {fixture:"brand_wishbonekitchen"}: the kit's assets from marketplace/fixtures/images/<assetId>.png
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const arcade = require('./arcade');
const market = require('./marketplace');
const { HttpsishError } = require('./flow');

const fail = (code, msg) => { throw new HttpsishError(code, msg); };
const HEX = /^#[0-9a-f]{6}$/;
const IG = /^@?[A-Za-z0-9._]{1,30}$/;
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const KINDS = ['logo', 'reference', 'instagram'];
const MAX_BYTES = 1024 * 1024;
const IMAGE_DIRS = [path.join(__dirname, '..', 'data', 'marketplace', 'images'),
  path.join(__dirname, '..', '..', '..', 'marketplace', 'fixtures', 'images')];
const PENDANT = 'A {metal} pendant shaped like {brand_element}, with a small engraved {fan_motif} on the back. No stones, purely graphic.';

const slug = (h) => String(h || '').replace(/^@/, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 56);
const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// default style refs: first logo + first reference + first instagram (no instagram: the next reference)
function defaultRefs(imgs) {
  const ok = imgs.filter((i) => i.referenceId);
  const firstOf = (k, skip = []) => ok.find((i) => i.kind === k && !skip.includes(i));
  const logo = firstOf('logo'), ref = firstOf('reference');
  const third = firstOf('instagram') || firstOf('reference', [ref]);
  return [logo, ref, third].filter(Boolean).map((i) => i.referenceId);
}

// 2.3: copies of Wishbone Kitchen's templates + rules, the brand element taken from the creator's style words
function formKit({ creatorId, name, handle, palette, styleWords, assets }) {
  const wk = market.fixture('brand_wishbonekitchen');
  const forbidden = wk.rules.forbidden_words.map((w) => new RegExp(`\\b${esc(w.toLowerCase())}\\b`));
  let elems = styleWords.slice(0, 3).filter((w) => !forbidden.some((re) => re.test(w.toLowerCase())) && !w.toLowerCase().includes(name.toLowerCase()));
  if (!elems.length) elems = ['the signature motif'];
  return { schema: 'brand.kit.v0', creatorId, name, handle, voice: styleWords.join(', '), motifs: styleWords,
    palette: palette.map((hex, i) => ({ name: `c${i + 1}`, hex, role: i < 2 ? 'primary' : 'accent' })),
    assets, rules: { ...wk.rules },
    templates: wk.templates.map((t) => ({ ...t, uses_assets: [], required_brand_element: elems, ...(t.world === 'jewelry' ? { brief: PENDANT } : {}) })) };
}

function readFixture(name) {
  const k = market.fixture(name);
  if (!k || k.schema !== 'brand.kit.v0') fail('invalid-argument', 'unknown fixture');
  const images = k.assets.map((a) => {
    const f = IMAGE_DIRS.map((d) => path.join(d, `${a.assetId}.png`)).find((x) => fs.existsSync(x));
    if (!f) fail('internal', `fixture image ${a.assetId}.png missing`);
    return { assetId: a.assetId, kind: a.kind, mediaType: 'image/png', bytes: fs.readFileSync(f) };
  });
  return { k, images };
}

function validateForm(d) {
  if (!d.name || typeof d.name !== 'string' || d.name.length > 80) fail('invalid-argument', 'name: 1-80 characters');
  const creatorId = 'creator-' + slug(d.handle);
  if (creatorId === 'creator-') fail('invalid-argument', 'handle: letters, digits or -');
  if (!IG.test(d.instagram || '')) fail('invalid-argument', 'instagram: a handle like @name (letters, digits, . _)');
  const palette = (Array.isArray(d.palette) ? d.palette : []).map((h) => String(h).toLowerCase());
  if (palette.length < 2 || palette.length > 6 || !palette.every((h) => HEX.test(h))) fail('invalid-argument', 'palette: 2-6 colours as #rrggbb');
  const styleWords = (Array.isArray(d.styleWords) ? d.styleWords : []).map((w) => String(w).trim()).filter(Boolean);
  if (styleWords.length > 8 || styleWords.some((w) => w.length > 40 || /[{}]/.test(w))) fail('invalid-argument', 'styleWords: at most 8, each <= 40 characters');
  if (d.styleRefs != null && (!Array.isArray(d.styleRefs) || d.styleRefs.length > 3 || !d.styleRefs.every(Number.isInteger))) fail('invalid-argument', 'styleRefs: at most 3 image indexes');
  return { creatorId, palette, styleWords, instagram: d.instagram.replace(/^@/, '') };
}

function decode(images) {
  if (!Array.isArray(images) || images.length < 1 || images.length > 6) fail('invalid-argument', 'images: 1-6');
  return images.map((im, i) => {
    if (!KINDS.includes(im.kind)) fail('invalid-argument', `images[${i}].kind: ${KINDS.join('|')}`);
    if (!TYPES.includes(im.mediaType)) fail('invalid-argument', `images[${i}].mediaType: ${TYPES.join('|')}`);
    const bytes = Buffer.from(String(im.dataBase64 || ''), 'base64');
    if (!bytes.length || bytes.length > MAX_BYTES) fail('invalid-argument', `images[${i}]: 1 byte to 1 MB`);
    return { assetId: `img-${i}`, kind: im.kind, mediaType: im.mediaType, bytes };
  });
}

async function onboard(db, uid, data = {}, { arc = arcade.client() } = {}) {
  let k, images, form;
  if (data.fixture) ({ k, images } = readFixture(data.fixture));
  else {
    form = validateForm(data);
    const extra = data.instagramMediaIds && data.instagramMediaIds.length ? await require('./instagram').fetchForOnboard(db, uid, data.instagramMediaIds) : [];
    images = decode([...(data.images || []), ...extra]);
  }
  const creatorId = k ? k.creatorId : form.creatorId;
  const ref = db.collection('creators').doc(creatorId);
  const privRef = ref.collection('private').doc('assets');
  const [prev, prevPriv] = await Promise.all([ref.get(), privRef.get()]);
  if (prevPriv.exists && prevPriv.data().owner !== uid) fail('permission-denied', 'that creatorId belongs to someone else');

  // same bytes -> same requestId, so a retried onboard makes no duplicate references; one bad image never stops the rest
  for (const im of images) {
    const base = arcade.rid('ref', creatorId, crypto.createHash('sha256').update(im.bytes).digest('hex'));
    try { im.referenceId = await arc.reference(im.mediaType, im.bytes, base); im.status = 'ready'; }
    catch (e) { console.error(`reference ${im.assetId}: ${e.message}`); im.referenceId = null; im.status = 'failed'; }
  }
  if (!images.some((i) => i.referenceId)) fail('unavailable', 'no image could be uploaded to Arcade');

  const assets = images.map(({ assetId, kind, mediaType, bytes }) => ({ assetId, kind, mediaType, byteLength: bytes.length }));
  if (k) k = { ...k, assets: k.assets.map((a) => ({ ...a, byteLength: assets.find((x) => x.assetId === a.assetId).byteLength })) };
  else k = formKit({ creatorId, name: data.name, handle: slug(data.handle), palette: form.palette, styleWords: form.styleWords, assets });
  const errs = market.validateKit(k);
  if (errs.length) fail('invalid-argument', `brand kit: ${errs.join('; ')}`);

  const chosen = form && data.styleRefs ? data.styleRefs.map((i) => (images[i] || {}).referenceId).filter(Boolean) : [];
  const styleRefs = (chosen.length ? chosen : data.fixture ? images.map((i) => i.referenceId).filter(Boolean) : defaultRefs(images)).slice(0, 3);
  const styleWords = form ? form.styleWords : k.motifs || [];
  const instagram = form ? form.instagram : k.handle || null;
  const imgs = images.map(({ kind, status, referenceId }) => ({ kind, status, referenceId }));
  const referenceIds = Object.fromEntries(images.filter((i) => i.referenceId).map((i) => [i.assetId, i.referenceId]));

  await ref.set({ ...market.publicKit(k), instagram, styleWords, createdAt: prev.exists ? prev.data().createdAt : Date.now(), updatedAt: Date.now() });
  await privRef.set({ owner: uid, assets: k.assets, referenceIds, templates: k.templates, styleRefs, images: imgs });
  await db.collection('users').doc(uid).set({ role: 'creator', creatorId }, { merge: true });
  return { creatorId, style: { images: imgs, styleRefs, palette: k.palette.map((c) => c.hex), styleWords } };
}

module.exports = { onboard, slug, formKit };

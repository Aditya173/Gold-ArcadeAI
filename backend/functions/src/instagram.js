// POST /instagram/scrape {handle, max?}: a public Instagram account's latest post images, ready for creator
// onboarding. Runs ../../../instagram/scrape.py (gallery-dl, logged out) with the PYTHON interpreter (needs
// gallery-dl + pillow). Locally that is the Functions emulator on the dev machine; a deployed Cloud Function has no
// Python, so production needs that script behind a small service (BRIEF_MARKETPLACE.md, 2.7).
// INSTAGRAM_SCRAPE_FAKE=1 makes the script serve generated images (tests, offline demo).
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { HttpsishError } = require('./flow');

const SCRIPT = path.join(__dirname, '..', '..', '..', 'instagram', 'scrape.py');
const HANDLE = /^@?[A-Za-z0-9._]{1,30}$/;

function run(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.env.PYTHON || 'python', [SCRIPT, ...args], { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    let out = '';
    let err = '';
    const t = setTimeout(() => { p.kill(); reject(new HttpsishError('unavailable', 'Instagram import timed out')); }, timeoutMs);
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => { clearTimeout(t); reject(new HttpsishError('unavailable', `cannot start the importer: ${e.message}`)); });
    p.on('close', () => { clearTimeout(t); resolve({ out, err }); });
  });
}

async function scrape(uid, body = {}, { timeoutMs = 150000 } = {}) {
  const handle = String(body.handle || '').trim();
  if (!HANDLE.test(handle)) throw new HttpsishError('invalid-argument', 'handle must be an Instagram username');
  const max = Math.min(Math.max(parseInt(body.max, 10) || 6, 1), 6);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-'));
  try {
    const { out, err } = await run(['--handle', handle, '--out', dir, '--max', String(max), '--json'], timeoutMs);
    let res;
    try { res = JSON.parse(out.trim().split('\n').pop()); } catch {
      throw new HttpsishError('unavailable', `Instagram import failed: ${(err || out).trim().split('\n').pop() || 'no output'}`);
    }
    if (res.error) throw new HttpsishError(res.error.code === 'invalid-argument' ? 'invalid-argument' : 'unavailable', res.error.message);
    // bytes go back to the caller (then into POST /creators/onboard as kind "instagram"); nothing is kept here
    return {
      handle: res.handle,
      source: res.source,
      images: res.images.map((i) => ({
        mediaId: i.mediaId, shortcode: i.shortcode, takenAt: i.takenAt, caption: i.caption,
        mediaType: i.mediaType, byteLength: i.byteLength, width: i.width, height: i.height,
        dataBase64: fs.readFileSync(i.file).toString('base64'),
      })),
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}


// ---- Connect Instagram (Meta's Instagram API with Instagram Login, instagram_business_basic), U4b ----
// The creator's own business/creator account only. Token lives at users/{uid}/private/instagram (server-only: the
// rules have no match for it, so clients are denied). Env (Functions secrets, never committed): INSTAGRAM_APP_ID,
// INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI; optional INSTAGRAM_RETURN_URL (where callback sends the app back).
// INSTAGRAM_FAKE=1: no Meta account needed; the "account" has 4 generated images (2 posts + a carousel of 2) and a video.
const crypto = require('crypto');
const zlib = require('zlib');

const GRAPH = 'https://graph.instagram.com';
const MAX_BYTES = 1000000;
const TYPES = /^image\/(png|jpeg|webp|gif)$/;
const fake = () => process.env.INSTAGRAM_FAKE === '1';
const tokenDoc = (db, uid) => db.doc(`users/${uid}/private/instagram`);
const secret = () => process.env.INSTAGRAM_APP_SECRET || (fake() ? 'fake-secret' : '');

function sign(uid, at = Date.now()) {
  const body = `${uid}.${at}`;
  return `${body}.${crypto.createHmac('sha256', secret()).update(body).digest('hex')}`;
}
function verify(state) {
  const m = /^([^.]+)\.(\d+)\.([0-9a-f]{64})$/.exec(String(state || ''));
  const ok = m && secret() && Date.now() - Number(m[2]) < 600000
    && crypto.timingSafeEqual(Buffer.from(sign(m[1], m[2]).slice(-64)), Buffer.from(m[3]));
  if (!ok) throw new HttpsishError('permission-denied', 'bad or expired Instagram state');
  return m[1];
}

// a solid-colour PNG, so the fake account has real image bytes without shipping any photos
function png(hex, size = 64) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type), data])));
    return Buffer.concat([len, Buffer.from(type), data, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(hex.slice(1).repeat(size), 'hex')]);
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(Array(size).fill(row)))), chunk('IEND', Buffer.alloc(0))]);
}
const img = (id, hex, day) => ({ id, media_type: 'IMAGE', media_url: `data:image/png;base64,${png(hex).toString('base64')}`,
  permalink: `https://www.instagram.com/p/${id}/`, timestamp: `2026-10-0${day}T12:00:00+0000` });
const FAKE_MEDIA = () => [
  img('fake-1', '#c8553d', 8),
  { id: 'fake-v', media_type: 'VIDEO', media_url: 'https://example.invalid/v.mp4', permalink: 'https://www.instagram.com/p/fake-v/', timestamp: '2026-10-07T12:00:00+0000' },
  { ...img('fake-c', '#000000', 6), media_type: 'CAROUSEL_ALBUM',
    children: { data: [img('fake-c1', '#f2d0a4', 6), img('fake-c2', '#588b8b', 6), { id: 'fake-cv', media_type: 'VIDEO' }] } },
  img('fake-4', '#ffd5c2', 5),
];

async function meta(url, init) {
  const r = await fetch(url, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error || j.error_message) {
    throw new HttpsishError('unavailable', `Instagram: ${j.error?.message || j.error_message || r.status}`);
  }
  return j;
}
const q = (o) => new URLSearchParams(o).toString();

// GET /instagram/connect -> {authUrl}
async function connect(db, uid) {
  const state = sign(uid);
  const redirect = process.env.INSTAGRAM_REDIRECT_URI || '';
  if (fake()) return { authUrl: `${redirect || '/instagram/callback'}?${q({ code: 'fake', state })}` };
  if (!process.env.INSTAGRAM_APP_ID || !redirect || !secret()) throw new HttpsishError('failed-precondition', 'Instagram Login is not configured');
  return { authUrl: `https://www.instagram.com/oauth/authorize?${q({ client_id: process.env.INSTAGRAM_APP_ID,
    redirect_uri: redirect, response_type: 'code', scope: 'instagram_business_basic', state })}` };
}

// GET /instagram/callback?code=&state= (open route; the uid comes from the signed state)
async function callback(db, query = {}) {
  const uid = verify(query.state);
  const code = String(query.code || '').replace(/#_$/, '');
  if (!code) throw new HttpsishError('invalid-argument', 'missing code');
  let doc;
  if (fake()) doc = { accessToken: 'fake-token', userId: 'fake-user', username: 'demo_creator', expiresAt: Date.now() + 5184000000 };
  else {
    const short = await meta('https://api.instagram.com/oauth/access_token', { method: 'POST', body: new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID, client_secret: secret(), grant_type: 'authorization_code',
      redirect_uri: process.env.INSTAGRAM_REDIRECT_URI, code }) });
    const long = await meta(`${GRAPH}/access_token?${q({ grant_type: 'ig_exchange_token', client_secret: secret(), access_token: short.access_token })}`);
    const me = await meta(`${GRAPH}/me?${q({ fields: 'user_id,username', access_token: long.access_token })}`);
    doc = { accessToken: long.access_token, userId: String(me.user_id), username: me.username, expiresAt: Date.now() + long.expires_in * 1000 };
  }
  await tokenDoc(db, uid).set({ ...doc, connectedAt: new Date().toISOString() });
  return { connected: true, username: doc.username, redirect: process.env.INSTAGRAM_RETURN_URL || null };
}

async function token(db, uid) {
  const s = await tokenDoc(db, uid).get();
  if (!s.exists) throw new HttpsishError('failed-precondition', 'connect Instagram first');
  return s.data();
}

// GET /instagram/status -> {connected, username}
async function status(db, uid) {
  const s = await tokenDoc(db, uid).get();
  if (!s.exists) return { connected: false, username: null };
  if (fake()) return { connected: true, username: s.data().username };
  try {
    const me = await meta(`${GRAPH}/me?${q({ fields: 'user_id,username', access_token: s.data().accessToken })}`);
    return { connected: true, username: me.username };
  } catch { return { connected: false, username: null }; } // expired or revoked
}

// GET /instagram/media?limit=24 -> {media:[{id, mediaType, mediaUrl, permalink, timestamp}]}: images only, carousels flattened
async function media(db, uid, query = {}) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 24, 1), 50);
  const t = await token(db, uid);
  const posts = fake() ? FAKE_MEDIA() : (await meta(`${GRAPH}/me/media?${q({ limit, access_token: t.accessToken,
    fields: 'id,media_type,media_url,permalink,timestamp,children{id,media_type,media_url}' })}`)).data || [];
  const out = [];
  for (const p of posts) {
    for (const c of p.media_type === 'CAROUSEL_ALBUM' ? p.children?.data || [] : [p]) {
      if (c.media_type === 'IMAGE' && c.media_url) {
        out.push({ id: c.id, mediaType: 'IMAGE', mediaUrl: c.media_url, permalink: p.permalink, timestamp: p.timestamp });
      }
    }
  }
  return { media: out.slice(0, limit) };
}

// POST /creators/onboard step 1b: instagramMediaIds -> images[] {kind:'instagram', mediaType, dataBase64}. Each ID must
// be one of this account's own images; media_url can expire, so bytes are fetched now and never stored here.
// ponytail: ownership = "in the account's latest 50 images"; page through /me/media if creators pick older posts.
async function fetchForOnboard(db, uid, ids = []) {
  if (!Array.isArray(ids) || ids.length > 4) throw new HttpsishError('invalid-argument', 'instagramMediaIds: at most 4');
  if (!ids.length) return [];
  const own = new Map((await media(db, uid, { limit: 50 })).media.map((m) => [m.id, m]));
  const out = [];
  for (const id of ids) {
    const m = own.get(String(id));
    if (!m) throw new HttpsishError('invalid-argument', `Instagram media ${id} is not one of your images`);
    let bytes, type;
    if (m.mediaUrl.startsWith('data:')) {
      [, type] = /^data:([^;]+);base64,/.exec(m.mediaUrl);
      bytes = Buffer.from(m.mediaUrl.split(',')[1], 'base64');
    } else {
      const r = await fetch(m.mediaUrl);
      if (!r.ok) throw new HttpsishError('unavailable', `Instagram media ${id}: download failed (${r.status})`);
      type = (r.headers.get('content-type') || '').split(';')[0];
      bytes = Buffer.from(await r.arrayBuffer());
    }
    if (!TYPES.test(type)) throw new HttpsishError('invalid-argument', `Instagram media ${id}: unsupported type ${type}`);
    if (bytes.length > MAX_BYTES) throw new HttpsishError('invalid-argument', `Instagram media ${id}: over 1 MB`);
    out.push({ kind: 'instagram', mediaId: m.id, mediaType: type, dataBase64: bytes.toString('base64') });
  }
  return out;
}

module.exports = { scrape, connect, callback, status, media, fetchForOnboard };

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

module.exports = { scrape };

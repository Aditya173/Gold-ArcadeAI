// Arcade client for Functions: a JS twin of arcade/arcade.py's call/wait/design.
// Until the hackathon ARCADE_BASE_URL points at arcade/mock_arcade.py --serve 8787. Any non-local host is refused
// unless ARCADE_LIVE=1 (same guard as arcade.py; nobody sets it before the hackathon).
const crypto = require('crypto');

class ArcadeError extends Error {
  constructor(status, body) { super(`${status} ${body && (body.message || body.code)}`); this.status = status; this.body = body; }
}

function client({ base = process.env.ARCADE_BASE_URL, key = process.env.ARCADE_API_KEY,
  pollMs = Number(process.env.ARCADE_POLL_MS ?? 1000), maxPolls = 60, fetchImpl = fetch, sleep } = {}) {
  if (!base) throw new Error('ARCADE_BASE_URL is not set (the mock: http://127.0.0.1:8787/v1)');
  const host = new URL(base).hostname;
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(host);
  if (!local && process.env.ARCADE_LIVE !== '1') {
    throw new Error(`refusing ${host}: Arcade calls are OFF until the hackathon (ARCADE_LIVE=1)`);
  }
  const nap = sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));

  async function call(proc, body, { fault } = {}) {
    if (!local) fault = undefined;           // X-Mock-Fault is a mock drill: never sent to a non-local Arcade
    for (let attempt = 0; ; attempt++) {
      const res = await fetchImpl(`${base}/${proc}`, { method: 'POST', body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...(fault ? { 'X-Mock-Fault': fault } : {}) } });
      const json = await res.json().catch(() => ({}));
      if (res.status === 429 && attempt < 3) { await nap(1000 * Number(res.headers.get('retry-after') || 1)); fault = undefined; continue; }
      if (!res.ok) throw new ArcadeError(res.status, json);
      return json;
    }
  }

  async function wait(jobId) {
    for (let i = 0; i < maxPolls; i++) {
      const job = await call('jobs/get', { jobId });
      if (job.status !== 'running' && job.status !== 'queued') return job;
      await nap(pollMs);
    }
    throw new Error(`job ${jobId} still running after ${maxPolls} polls`);
  }

  // patterns/create -> wait -> products/get; one flat record like arcade.py design()
  async function design(prompt, categoryId, { colors, referenceIds, requestId, fault } = {}) {
    const body = { requestId, prompt: prompt.slice(0, 1000), categoryId, ...(colors && colors.length ? { colors: colors.slice(0, 10) } : {}),
      ...(referenceIds && referenceIds.length ? { referenceIds: referenceIds.slice(0, 3) } : {}) };   // both print only
    let job;
    try { job = await call('patterns/create', body, { fault }); } catch (e) {
      if (e instanceof ArcadeError && e.status === 400) return { ok: false, stage: 'admit', status: 400, reason: e.message, request: body };
      throw e;
    }
    job = await wait(job.jobId);
    if (job.status === 'failed' || !job.result) return { ok: false, stage: 'job', reason: (job.error || {}).message, request: body };
    const product = await call('products/get', { productId: job.result.productId });
    return { ok: true, patternId: job.result.patternId, product, request: body };
  }
  // = arcade.py reference: createUpload -> (PUT the bytes to uploadUrl) -> create; returns a referenceId (print only)
  // ponytail: no PUT yet -- a brand kit carries asset metadata, not bytes; add the upload when kits carry files
  async function reference(mediaType, byteLength, requestId) {
    const up = await call('references/createUpload', { requestId: `${requestId}-u`, mediaType, byteLength });
    return (await call('references/create', { requestId: `${requestId}-c`, uploadId: up.uploadId })).referenceId;
  }
  return { call, wait, design, reference, local };
}

// = arcade/run_designs.py WANT + pick (the plainest matching category)
const WANT = { ring: ['jewelry', ['ring']], 'pendant necklace': ['jewelry', ['pendant']], earrings: ['jewelry', ['earring']],
  rug: ['print', ['rug']], 'throw pillow': ['print', ['pillow']], 'wall art print': ['print', ['print']],
  textile: ['print', ['textile']], ceramic: ['print', ['ceramic']] };
function pick(cats, category) {
  const w = WANT[category];
  if (!w) return null;
  const cand = cats.filter((c) => c.world === w[0] && w[1].every((x) => `${c.name} ${(c.category || {}).name || ''}`.toLowerCase().includes(x)));
  return cand.sort((a, b) => a.name.length - b.name.length)[0] || null;
}

const rid = (...parts) => 'gold-app-' + crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 24);

module.exports = { client, pick, rid, ArcadeError };

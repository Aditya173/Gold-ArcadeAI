// Gold insight packs: the ONLY source of readings for the demo. A pack is a gold.reading.v0 file:
//   gold_sdk/fixtures/*.json   invented people (kind "fixture")
//   gold_sdk/insights/*.json   portrait archetypes (kind "archetype")
// The protected Gold SDK will later produce the same gold.reading.v0 from a user's own photos.
// Read in place from ../gold_sdk in the emulator. A deploy uploads only functions/, so firebase.json's predeploy
// runs `node src/packs.js --copy` to put them in functions/data/packs/ (and the marketplace fixtures in
// functions/data/marketplace/; both gitignored), which win when present.
const fs = require('fs');
const path = require('path');

const SDK = path.join(__dirname, '..', '..', '..', 'gold_sdk');
const COPY = path.join(__dirname, '..', 'data', 'packs');
const SOURCES = [['fixture', 'fixtures'], ['archetype', 'insights']];
const ID = /^[a-z0-9][a-z0-9_-]*$/;
const HEX = /^#[0-9a-f]{6}$/;
const PALETTE_SOURCES = ['lives_with', 'goes_to', 'saves'];

// = gold_sdk.validate: the contract's load-bearing rules, no jsonschema dependency
function validate(r) {
  const need = (ok, what) => { if (!ok) throw new Error(`gold reading: ${what}`); };
  need(r && r.schema === 'gold.reading.v0', 'schema');
  for (const k of ['photos', 'signature', 'palette', 'places', 'reliability']) need(k in r, `missing ${k}`);
  for (const s of r.signature) {
    need(s.idea && s.share_of_events >= 0 && s.share_of_events <= 1 && s.strength >= 0 && s.strength <= 1, `signature ${s.idea}`);
    need(Array.isArray(s.evidence), `signature ${s.idea}: evidence`);
  }
  for (const c of r.palette) need(HEX.test(c.hex) && PALETTE_SOURCES.includes(c.source), `palette ${c.hex}`);
  for (const p of r.people || []) need(/^person-\d+$/.test(p.ref), 'people are anonymous refs, never names');
  return r;
}

function dirs() {
  return SOURCES.map(([kind, sub]) => [kind, fs.existsSync(path.join(COPY, sub)) ? path.join(COPY, sub) : path.join(SDK, sub)]);
}

// [{id, kind, file}]
function index() {
  return dirs().flatMap(([kind, dir]) => (fs.existsSync(dir) ? fs.readdirSync(dir) : [])
    .filter((f) => f.endsWith('.json')).map((f) => ({ id: f.slice(0, -5), kind, file: path.join(dir, f) })))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}

const summary = ({ id, kind, file }) => {
  const r = JSON.parse(fs.readFileSync(file, 'utf8'));
  const a = r.archetype || {};
  return { id, kind, name: a.name || null, oneLine: a.one_line || null, photos: r.photos,
    ideas: r.signature.map((s) => s.idea), palette: r.palette.map((c) => c.hex), signatureReliability: (r.reliability.signature || {}).status || null };
};

const list = () => index().map(summary);

// the full reading, marked stub: a pack is never a reading of the user's own photos
function load(id) {
  const hit = typeof id === 'string' && ID.test(id) && index().find((p) => p.id === id);
  if (!hit) return null;
  return { kind: hit.kind, reading: validate({ ...JSON.parse(fs.readFileSync(hit.file, 'utf8')), stub: true }) };
}

if (require.main === module && process.argv.includes('--copy')) {
  for (const [, sub] of SOURCES) {
    fs.mkdirSync(path.join(COPY, sub), { recursive: true });
    for (const f of fs.readdirSync(path.join(SDK, sub)).filter((x) => x.endsWith('.json'))) fs.copyFileSync(path.join(SDK, sub, f), path.join(COPY, sub, f));
  }
  const mk = path.join(__dirname, '..', 'data', 'marketplace');      // marketplace fixtures (src/marketplace.js)
  fs.mkdirSync(mk, { recursive: true });
  for (const f of fs.readdirSync(path.join(SDK, '..', 'marketplace', 'fixtures'))) fs.copyFileSync(path.join(SDK, '..', 'marketplace', 'fixtures', f), path.join(mk, f));
  console.log(`copied packs to ${COPY} and marketplace fixtures to ${mk}`);
}

module.exports = { list, load, index, validate };

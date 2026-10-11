// The storefront planner: a JS port of planner/planner.py (SYSTEM, evidence text, check). A Gold reading in,
// a store + one Arcade-ready piece per category out. The rules are enforced in code by check(), not just asked for.
// With ANTHROPIC_API_KEY: one Claude call (retried once with the errors). Without it, offline: the recorded plan
// for creator_maya (data/plan_creator_maya.json), else a deterministic template plan built from the reading.
// Both still go through check().
const fs = require('fs');
const path = require('path');

const MODEL = 'claude-opus-5-5', EFFORT = 'high', MAX_TOKENS = 16000;
const CATEGORIES = ['ring', 'pendant necklace', 'earrings', 'rug', 'throw pillow', 'wall art print'];
const JEWELRY = new Set(['ring', 'pendant necklace', 'earrings']);
const RECORDED = { 'fixture-creator-maya': 'plan_creator_maya.json' };   // reading.subject -> recorded plan

// = planner.SYSTEM, verbatim
const SYSTEM = `You are building a small storefront of made-to-order pieces for one person, made by
artisan makers through Arcade (jewelry in 14k gold, sterling silver, brass and gemstones; rugs,
pillows and wall prints printed from a pattern). You are given a reading of what sets this
person's photos apart from other people's, their photo palette, and optionally a few lines in
their own words.

Write the store as JSON:
{"store": {"name": str (2-3 words, not the person's legal name), "tagline": str (<= 10 words),
           "about": str (2-3 sentences, second person, warm, specific, no flattering filler),
           "palette": [3-5 hex copied from the input]},
 "products": [{"category": one of the requested categories, "title": str (2-4 words),
               "prompt": str (<= 600 chars, concrete and makeable: category, metal/material,
                         finish, scale, stones or pattern, motif; no brand names, logos, people,
                         named landmarks, or text),
               "colors": [hex] (print categories only, 3-6 from the input palette; [] for jewelry),
               "why": str (1-2 sentences to the person: which idea this piece comes from and the
                      evidence, e.g. "coastal walks show up in 29% of your moments"),
               "signature": [the 1-3 idea names it draws on, copied exactly from the input]}]}

Rules: exactly one product per requested category. Spread the collection across different ideas
so it covers the person, not one note. The ideas are visual readings, not facts about the person:
never name an institution, a city's landmark or a brand. Prefer geometry, pattern and colour over
literal pictures. \`why\` must be TRUE TO THE INPUT: name the idea in plain words and quote its
share exactly as given. Never present design details as evidence; they belong in the prompt.
Lines in the person's own words may add one touch, attributed as "you said".
Return ONLY the JSON.`;

const pct = (x) => `${Math.round(x * 100)}%`;

function evidenceText(r, ownWords = '') {
  const L = [`Reading of ${r.photos.count} photos over ${r.photos.events} moments. ` +
    'What sets them apart (share of moments it shows up in):'];
  for (const s of r.signature) {
    const syn = (s.synonyms || []).length ? ` (also: ${s.synonyms.slice(0, 3).join(', ')})` : '';
    L.push(`- ${s.idea}${syn}: ${pct(s.share_of_events)} of moments`);
  }
  L.push('Palette: ' + r.palette.map((c) => `${c.name} ${c.hex} ${pct(c.share)} (${c.source.replace(/_/g, ' ')})`).join(', '));
  if ((r.places || []).length) L.push('Kinds of place: ' + r.places.map((p) => `${p.type} ${pct(p.share_of_events)}`).join(', '));
  if (ownWords) L.push(`In their own words: "${ownWords}"`);
  return L.join('\n');
}

// every share the reading states, as the planner may quote it ("41%")
const shares = (r) => new Set([...r.signature.map((s) => pct(s.share_of_events)), ...(r.places || []).map((p) => pct(p.share_of_events))]);

// = planner.check
function check(plan, cats, r) {
  const errs = [];
  const palette = new Set(r.palette.map((c) => c.hex.toLowerCase()));
  const ideas = new Set(r.signature.map((s) => s.idea));
  const ok = shares(r);
  const st = (plan && plan.store) || {};
  for (const k of ['name', 'tagline', 'about']) if (!st[k]) errs.push(`store.${k} missing`);
  const products = (plan && plan.products) || [];
  const got = products.map((p) => p.category);
  if (JSON.stringify([...got].sort()) !== JSON.stringify([...cats].sort())) errs.push(`categories ${JSON.stringify(got)} != ${JSON.stringify(cats)}`);
  for (const p of products) {
    const c = p.category, colors = p.colors || [];
    if (!(0 < (p.prompt || '').length && (p.prompt || '').length <= 1000)) errs.push(`${c}: prompt length`);
    if (JEWELRY.has(c) && colors.length) errs.push(`${c}: jewelry cannot take colors`);
    if (colors.some((h) => !palette.has(String(h).toLowerCase()))) errs.push(`${c}: colour not from the palette`);
    if (!(p.signature || []).every((x) => ideas.has(x))) errs.push(`${c}: cites an idea the reading does not have`);
    const quoted = [...new Set((p.why || '').match(/\d+%/g) || [])];
    if (!p.why || !quoted.length || !quoted.every((q) => ok.has(q))) errs.push(`${c}: why must quote a share the reading states (got ${JSON.stringify(quoted.sort())})`);
  }
  return errs;
}

async function askClaude(system, user, { key, fetchImpl }) {
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system, messages: [{ role: 'user', content: user }],
      thinking: { type: 'adaptive' }, output_config: { effort: EFFORT } }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(j.error || {}).message || ''}`);
  if (['refusal', 'max_tokens'].includes(j.stop_reason)) throw new Error(`plan: unusable reply (${j.stop_reason})`);
  const text = j.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('plan: no JSON in reply');
  return JSON.parse(m[0]);
}

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const JEWELRY_BRIEF = {
  ring: 'Ring in sterling silver, a 4 mm band with a quiet geometric relief',
  'pendant necklace': 'Pendant necklace in brass, an 18 mm disc with a low geometric relief on a 45 cm fine chain',
  earrings: 'Earrings in sterling silver, a pair of 10 mm studs with a small geometric relief',
};
const PRINT_BRIEF = {
  rug: 'Rug, hand-tufted wool, 5x8 ft, broad abstract bands and blocks',
  'throw pillow': 'Throw pillow, 18x18 in woven cover, a loose repeating abstract pattern',
  'wall art print': 'Wall art print, 12x16 in matte paper, an abstract composition of soft-edged shapes',
};

// Offline stand-in for the Claude call: one piece per category, ideas spread round-robin (strongest first),
// print colours from the palette, every why quoting a share the reading states. Plain copy by design.
// ponytail: template copy reads flat next to a Claude plan; it exists so every pack demos offline
function templatePlan(r, cats = CATEGORIES) {
  const sig = [...r.signature].sort((a, b) => b.share_of_events - a.share_of_events);
  const hexes = r.palette.map((c) => c.hex).slice(0, 5);
  const a = r.archetype || {};
  const products = cats.map((category, i) => {
    const s = sig[i % sig.length];
    const jewel = JEWELRY.has(category);
    const prompt = jewel
      ? `${JEWELRY_BRIEF[category] || category} suggesting ${s.idea}, satin finish, no stones, no text.`
      : `${PRINT_BRIEF[category] || category} suggesting ${s.idea}, in ${r.palette.slice(0, 5).map((c) => c.name).join(', ')}, no text, no logos.`;
    return { category, title: cap(s.idea).split(' ').slice(0, 4).join(' '), prompt, colors: jewel ? [] : hexes,
      why: `${cap(s.idea)} shows up in ${pct(s.share_of_events)} of your moments.`, signature: [s.idea] };
  });
  return { store: { name: a.name || `${cap(sig[0].idea).split(' ').slice(0, 2).join(' ')} Studio`,
    tagline: (a.title_phrasings || [])[0] || `Made from ${sig[0].idea} and ${sig[1 % sig.length].idea}`,
    about: a.one_line || `Your photos keep returning to ${sig[0].idea}. These pieces take their colours from your palette.`,
    palette: hexes }, products };
}

function offline(r, cats) {
  const f = r.stub && RECORDED[r.subject];
  if (f) return { ...JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8')), _model: 'recorded' };
  return { ...templatePlan(r, cats), _model: 'template' };
}

// ponytail: no spend ledger or response cache here (planner.py has both); add before a key goes into shared config
async function plan(r, { cats = CATEGORIES, ownWords = '', key = process.env.ANTHROPIC_API_KEY, fetchImpl = fetch, tries = 2 } = {}) {
  let errs = [];
  if (!key) {
    const p = offline(r, cats);
    errs = check(p, cats, r);
    if (errs.length) throw new Error(`${p._model} plan fails the rules: ${errs.join('; ')}`);
    return p;
  }
  const user = `Requested categories: ${cats.join(', ')}\n\n` + evidenceText(r, ownWords);
  for (let i = 0; i < tries; i++) {
    const p = await askClaude(SYSTEM, user + (i === 0 ? '' : `\n\n(retry ${i}: fix: ${JSON.stringify(errs)})`), { key, fetchImpl });
    errs = check(p, cats, r);
    if (!errs.length) return { ...p, _model: MODEL };
  }
  throw new Error(`plan rejected after ${tries} tries: ${errs.join('; ')}`);
}

module.exports = { askClaude, plan, check, templatePlan, evidenceText, shares, SYSTEM, CATEGORIES, JEWELRY };

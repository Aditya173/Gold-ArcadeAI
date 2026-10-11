// npm test (offline). The brand-template marketplace rules: marketplace.py selftest cases, ported.
const test = require('node:test');
const assert = require('node:assert');
const M = require('../src/marketplace');
const packs = require('../src/packs');

const kit = () => M.fixture('brand_tide_and_clay');
const tpl = (k, id) => k.templates.find((t) => t.templateId === id);
const fan = (id = 'archetype-first-light-solitary') => packs.load(id).reading;
const FANS = [['tc-print', 'archetype-first-light-solitary'], ['tc-pillow', 'archetype-small-table-host'], ['tc-pendant', 'archetype-night-shift-builder']];

function good() {
  const r = fan(), idea = r.signature[0];
  return { r, idea, item: { title: 'Ridge Rings', brief: `A 12x16 in wall print: thrown-ring stripes framing ${idea.idea}. Flat colour, no faces.`,
    fan_idea: idea.idea, colors: ['#b8714a', '#9fb8ad'], why_owner: `It shows up in ${Math.round(idea.share_of_events * 100)}% of your moments.`,
    public_tag: 'for early risers' } };
}

test('validate_kit: the Tide & Clay kit passes; broken kits are refused', () => {
  assert.deepStrictEqual(M.validateKit(kit()), []);
  const k = kit(); k.templates[2].uses_assets = ['logo'];
  assert.ok(M.validateKit(k).some((e) => /jewelry takes no references/.test(e)));
  const k2 = kit(); k2.templates[0].uses_assets = ['nope'];
  assert.ok(M.validateKit(k2).some((e) => /unknown asset/.test(e)));
  const k3 = kit(); k3.templates[0].brief = 'no motif slot';
  assert.ok(M.validateKit(k3).length);
  assert.ok(M.validateKit({ ...kit(), schema: 'x' }).length);
  assert.ok(M.validateKit({ ...kit(), creatorId: 'a/b' }).length);
});

test('check_item = marketplace.py selftest: a good print item passes, each broken rule is caught', () => {
  const k = kit(), t = tpl(k, 'tc-print');
  const { r, item } = good();
  assert.deepStrictEqual(M.checkItem(item, k, t, r), []);
  for (const [bad, why] of [
    [{ ...item, colors: ['#b8714a'] }, 'too few brand colours'],
    [{ ...item, brief: item.brief.replace('thrown-ring stripes', 'stripes') }, 'brand element missing'],
    [{ ...item, brief: item.brief + ' Add the Tide & Clay logo.' }, 'forbidden word'],
    [{ ...item, brief: item.brief + ' By Tide & Clay.' }, 'creator name'],
    [{ ...item, why_owner: 'It shows up in 99% of your moments.' }, "quote the idea's share"],
    [{ ...item, colors: ['#b8714a', '#9fb8ad', '#ff0000'] }, 'neither brand nor fan'],
    [{ ...item, fan_idea: 'surfing' }, 'not one of the fan'],
    [{ ...item, public_tag: 'for 5am people' }, 'public_tag'],
    [{ ...item, public_tag: 'for people who get up very early' }, 'public_tag'],
    [{ ...item, brief: 'A {size} wall print: thrown-ring stripes.' }, 'unfilled slot'],
  ]) assert.ok(M.checkItem(bad, k, t, r).some((e) => e.includes(why)), `${why}: ${M.checkItem(bad, k, t, r)}`);
  const fanAccent = r.palette.map((c) => c.hex).find((h) => !k.palette.some((c) => c.hex === h));
  assert.deepStrictEqual(M.checkItem({ ...item, colors: [...item.colors, fanAccent] }, k, t, r), [], 'one fan accent is allowed');
  const other = fan('archetype-grid-keeper').palette.map((c) => c.hex).filter((h) => !r.palette.some((c) => c.hex === h) && !k.palette.some((c) => c.hex === h));
  if (other.length) assert.ok(M.checkItem({ ...item, colors: [...item.colors, other[0]] }, k, t, r).length, "another fan's colour is refused");
});

test('check_item: jewelry takes no colours', () => {
  const k = kit(), tj = tpl(k, 'tc-pendant');
  const { r, idea, item } = good();
  const gj = { ...item, brief: `A sterling silver pendant in the shape of the wave-and-wheel mark, a small engraved ${idea.idea} on the back. No stones.`, colors: [] };
  assert.deepStrictEqual(M.checkItem(gj, k, tj, r), []);
  assert.ok(M.checkItem({ ...gj, colors: ['#b8714a', '#9fb8ad'] }, k, tj, r).some((e) => /jewelry/.test(e)));
});

test('the recorded items pass check_item', () => {
  const k = kit(), rec = M.fixture('recorded_items');
  for (const [tid, pack] of FANS) assert.deepStrictEqual(M.checkItem(rec[`${tid}|${pack}`], k, tpl(k, tid), fan(pack)), [], tid);
});

test('template fill: every pack x every template gives an item that passes check_item, with a non-personal tag', () => {
  const k = kit();
  for (const t of k.templates) for (const { id } of packs.list()) {
    const r = fan(id), it = M.templateFill(k, t, r);
    assert.ok(it, `${t.templateId} x ${id}`);
    assert.deepStrictEqual(M.checkItem(it, k, t, r), [], `${t.templateId} x ${id}`);
    assert.ok(!it.public_tag.includes(it.fan_idea));
  }
});

test('planItem: recorded first, then one Claude call when a key is set, else the template fill', async () => {
  const k = kit();
  assert.strictEqual((await M.planItem(k, tpl(k, 'tc-print'), fan(), { key: '' })).model, 'recorded');
  assert.strictEqual((await M.planItem(k, tpl(k, 'tc-print'), fan('archetype-grid-keeper'), { key: '' })).model, 'template');
  const sent = [];
  const fetchImpl = async (url, init) => { sent.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"title":"x"}' }] }) }; };
  const p = await M.planItem(k, tpl(k, 'tc-print'), fan('archetype-grid-keeper'), { key: 'k', fetchImpl });
  assert.strictEqual(p.model, 'claude-opus-5-5');
  assert.strictEqual(sent[0].system, M.SYSTEM);
  assert.ok(sent[0].messages[0].content.includes('Required brand element (one of)'));
});

test('the public kit carries no asset internals (no referenceIds, sizes or template briefs)', () => {
  const pub = M.publicKit(kit());
  const text = JSON.stringify(pub);
  assert.ok(!/byteLength|mediaType|describe|referenceId|\{fan_motif\}/.test(text), text);
  assert.deepStrictEqual(pub.templates.map((t) => t.templateId), ['tc-print', 'tc-pillow', 'tc-pendant']);
});

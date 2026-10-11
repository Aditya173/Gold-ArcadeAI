// Fake products (local simulation): the shipped products.json validates; bad entries name product + field.
const test = require('node:test');
const assert = require('node:assert');
const F = require('../src/fakes');

test('fakes: the shipped products.json validates and its images exist', () => {
  const list = F.readFakes();
  assert.ok(list.length >= 3);
  assert.ok(list.some((p) => p.maker === 'creator') && list.some((p) => p.maker === 'fan'));
  for (const p of list) if (!/^https:/.test(p.image)) assert.ok(F.assetPath(p.image), p.image);
});

test('fakes: bad entries are refused with product and field named', () => {
  const ok = { creatorId: 'creator-wishbonekitchen', maker: 'creator', title: 'T', category: 'textile',
    price: { amount: '10.00', currency: 'USD' }, image: 'https://example.com/a.jpg' };
  assert.deepStrictEqual(F.validateFake(ok), []);
  for (const [patch, want] of [[{ maker: 'brand' }, 'maker'], [{ category: 'mug' }, 'category'],
    [{ price: { amount: '10', currency: 'USD' } }, 'price'], [{ image: '../secret.jpg' }, 'image'],
    [{ image: 'missing.jpg' }, 'not found'], [{ public_tag: 'top 10 pick' }, 'public_tag'],
    [{ why: 'x' }, 'fan items only'], [{ creatorId: 'wishbone' }, 'creatorId']]) {
    const e = F.validateFake({ ...ok, ...patch }, 4);
    assert.ok(e.some((x) => x.includes(want) && x.startsWith('products[4] "T"')), `${want}: ${e}`);
  }
  assert.strictEqual(F.assetPath('../../package.json'), null, 'no path escapes');
});

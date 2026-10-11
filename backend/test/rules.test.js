// Firestore + Storage rules. Run inside the emulators: npm run test:rules
// The point: a published store's public copy is public; its evidence photos, owner uid and reading never are.
const test = require('node:test');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, collection, getDocs } = require('firebase/firestore');
const { ref, uploadString, getBytes, getDownloadURL } = require('firebase/storage');

let env;
const OWNER = 'alice', BUYER = 'bob';
const PHOTO = `users/${OWNER}/photos/s1/photo_000.jpg`;

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-storefront',
    firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync(resolve(__dirname, '../storage.rules'), 'utf8'), host: '127.0.0.1', port: 9199 },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [id, status] of [['s1', 'published'], ['s2', 'planned']]) {
      await setDoc(doc(db, 'stores', id), { owner: OWNER, status, reading: { stub: true } });
      await setDoc(doc(db, 'stores', id, 'products', 'p00'), { title: 'Band', why: 'Coastal walks appear in 29% of your moments.', status: 'designed' });
      await setDoc(doc(db, 'stores', id, 'products', 'p04'), { title: 'Declined', why: 'declined piece', status: 'declined' });
      await setDoc(doc(db, 'stores', id, 'private', 'evidence'), { photos: [PHOTO], products: { p00: [PHOTO] } });
    }
    await setDoc(doc(db, 'public', 's1'), { name: 'Store', about: null });
    await setDoc(doc(db, 'public', 's1', 'products', 'p00'), { title: 'Band', why: null });
    await setDoc(doc(db, 'users', OWNER, 'insights', 'current'), { pack: 'creator_maya', reading: { stub: true } });
    await setDoc(doc(db, 'creators', 'c1'), { name: 'Kit', palette: [] });
    await setDoc(doc(db, 'creators', 'c1', 'private', 'assets'), { owner: OWNER, referenceIds: { logo: 'ref-1' } });
    await setDoc(doc(db, 'marketplace', 'i1'), { creatorId: 'c1', status: 'listed', title: 'Piece', stats: { buys: 0 } });
    await setDoc(doc(db, 'marketplace', 'i1', 'private', 'owner'), { makerUid: BUYER, owner_only: { fan_idea: 'x', why: 'y' } });
    await setDoc(doc(db, 'marketplace', 'i2'), { creatorId: 'c1', status: 'not_makeable', title: 'Nope' });
    await setDoc(doc(db, 'orders', 'o1'), { buyer: BUYER, storeOwner: OWNER, storeId: 's1' });
    await uploadString(ref(ctx.storage(), PHOTO), 'jpegbytes', 'raw', { contentType: 'image/jpeg' });
  });
});
test.after(() => env.cleanup());

const anon = () => env.unauthenticatedContext();
const user = (u) => env.authenticatedContext(u);

test('public (signed out) reads the published copy and its products', async () => {
  await assertSucceeds(getDoc(doc(anon().firestore(), 'public', 's1')));
  await assertSucceeds(getDocs(collection(anon().firestore(), 'public', 's1', 'products')));
});

test('the owner-only store doc (owner uid, reading) and its declined pieces are not public, even once published', async () => {
  for (const ctx of [anon(), user(BUYER)]) {
    await assertFails(getDoc(doc(ctx.firestore(), 'stores', 's1')));
    await assertFails(getDocs(collection(ctx.firestore(), 'stores', 's1', 'products')));
    await assertFails(getDoc(doc(ctx.firestore(), 'stores', 's1', 'products', 'p04')));
  }
  await assertSucceeds(getDoc(doc(user(OWNER).firestore(), 'stores', 's1', 'products', 'p04')));
});

test('public store CANNOT read evidence: not the private doc, not the photo (signed out or another user)', async () => {
  for (const ctx of [anon(), user(BUYER)]) {
    await assertFails(getDoc(doc(ctx.firestore(), 'stores', 's1', 'private', 'evidence')));
    await assertFails(getBytes(ref(ctx.storage(), PHOTO)));
    await assertFails(getDownloadURL(ref(ctx.storage(), PHOTO)));
  }
});

test('a draft store is owner-only', async () => {
  await assertFails(getDoc(doc(anon().firestore(), 'stores', 's2')));
  await assertFails(getDoc(doc(user(BUYER).firestore(), 'stores', 's2')));
  await assertFails(getDocs(collection(user(BUYER).firestore(), 'stores', 's2', 'products')));
  await assertSucceeds(getDoc(doc(user(OWNER).firestore(), 'stores', 's2')));
});

test('the owner reads their evidence and photos', async () => {
  await assertSucceeds(getDoc(doc(user(OWNER).firestore(), 'stores', 's1', 'private', 'evidence')));
  await assertSucceeds(getBytes(ref(user(OWNER).storage(), PHOTO)));
});

test('no client writes stores, products, evidence, public copies or orders (Functions only)', async () => {
  const db = user(OWNER).firestore();
  await assertFails(updateDoc(doc(db, 'stores', 's2'), { status: 'published' }));
  await assertFails(setDoc(doc(db, 'stores', 's9'), { owner: OWNER, status: 'published' }));
  await assertFails(updateDoc(doc(db, 'stores', 's1', 'products', 'p00'), { why: 'invented' }));
  await assertFails(setDoc(doc(db, 'stores', 's1', 'private', 'evidence'), { photos: [] }));
  await assertFails(setDoc(doc(user(BUYER).firestore(), 'orders', 'o2'), { buyer: BUYER }));
  await assertFails(setDoc(doc(db, 'public', 's1'), { name: 'forged' }));
  await assertFails(setDoc(doc(db, 'public', 's1', 'products', 'p00'), { why: 'invented' }));
});

test('attached insights: the owner reads them; nobody writes them, and nobody else reads them', async () => {
  await assertSucceeds(getDoc(doc(user(OWNER).firestore(), 'users', OWNER, 'insights', 'current')));
  await assertFails(setDoc(doc(user(OWNER).firestore(), 'users', OWNER, 'insights', 'current'), { pack: 'forged' }));
  await assertFails(getDoc(doc(user(BUYER).firestore(), 'users', OWNER, 'insights', 'current')));
  await assertFails(getDoc(doc(anon().firestore(), 'users', OWNER, 'insights', 'current')));
});

test('marketplace: listed items and creator kits are public; a non-maker cannot read private/owner', async () => {
  await assertSucceeds(getDoc(doc(anon().firestore(), 'creators', 'c1')));
  await assertSucceeds(getDoc(doc(anon().firestore(), 'marketplace', 'i1')));
  await assertFails(getDoc(doc(anon().firestore(), 'marketplace', 'i2')));                       // not listed
  await assertSucceeds(getDoc(doc(user(BUYER).firestore(), 'marketplace', 'i1', 'private', 'owner')));   // the maker
  for (const ctx of [anon(), user(OWNER), user('carol')]) await assertFails(getDoc(doc(ctx.firestore(), 'marketplace', 'i1', 'private', 'owner')));
  await assertSucceeds(getDoc(doc(user(OWNER).firestore(), 'creators', 'c1', 'private', 'assets')));
  for (const ctx of [anon(), user(BUYER)]) await assertFails(getDoc(doc(ctx.firestore(), 'creators', 'c1', 'private', 'assets')));
});

test('marketplace: nobody writes creators or marketplace directly, not even the maker or the creator', async () => {
  for (const ctx of [user(OWNER), user(BUYER)]) {
    const db = ctx.firestore();
    await assertFails(setDoc(doc(db, 'marketplace', 'i3'), { creatorId: 'c1', status: 'listed' }));
    await assertFails(updateDoc(doc(db, 'marketplace', 'i1'), { 'stats.buys': 99 }));
    await assertFails(setDoc(doc(db, 'marketplace', 'i1', 'private', 'owner'), { makerUid: 'x' }));
    await assertFails(setDoc(doc(db, 'creators', 'c1'), { name: 'forged' }));
    await assertFails(setDoc(doc(db, 'creators', 'c1', 'private', 'assets'), { owner: 'x' }));
  }
});

test('unmatched collections are denied', async () => {
  await assertFails(getDoc(doc(anon().firestore(), 'somethingElse', 'x')));
  await assertFails(setDoc(doc(user(OWNER).firestore(), 'somethingElse', 'x'), { a: 1 }));
});

test('orders: the buyer and the store owner read; others do not', async () => {
  await assertSucceeds(getDoc(doc(user(BUYER).firestore(), 'orders', 'o1')));
  await assertSucceeds(getDoc(doc(user(OWNER).firestore(), 'orders', 'o1')));
  await assertFails(getDoc(doc(user('carol').firestore(), 'orders', 'o1')));
  await assertFails(getDoc(doc(anon().firestore(), 'orders', 'o1')));
});

test('storage: only the owner uploads, downscaled JPEGs only (no full-size original)', async () => {
  await assertSucceeds(uploadString(ref(user(OWNER).storage(), `users/${OWNER}/photos/s3/a.jpg`), 'x', 'raw', { contentType: 'image/jpeg' }));
  await assertFails(uploadString(ref(user(BUYER).storage(), `users/${OWNER}/photos/s3/b.jpg`), 'x', 'raw', { contentType: 'image/jpeg' }));
  await assertFails(uploadString(ref(user(OWNER).storage(), `users/${OWNER}/photos/s3/c.txt`), 'x', 'raw', { contentType: 'text/plain' }));
  await assertFails(uploadString(ref(user(OWNER).storage(), `users/${OWNER}/photos/s3/big.jpg`), 'x'.repeat(2 * 1024 * 1024 + 1), 'raw', { contentType: 'image/jpeg' }));
  await assertFails(uploadString(ref(user(OWNER).storage(), `users/${OWNER}/photos/s3/d.heic`), 'x', 'raw', { contentType: 'image/heic' }));
});

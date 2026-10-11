// Firestore + Storage rules. Run inside the emulators: npm run test:rules
// The point: creator kits and listed items are public; owner uids, readings, reasons and tokens never are; clients write nothing.
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
    await setDoc(doc(db, 'users', OWNER), { role: 'creator', creatorId: 'c1' });
    await setDoc(doc(db, 'users', OWNER, 'private', 'instagram'), { token: 'server-only' });
    await setDoc(doc(db, 'users', OWNER, 'insights', 'current'), { pack: 'creator_maya', reading: { stub: true } });
    await setDoc(doc(db, 'creators', 'c1'), { name: 'Kit', palette: [] });
    await setDoc(doc(db, 'creators', 'c1', 'private', 'assets'), { owner: OWNER, referenceIds: { logo: 'ref-1' } });
    await setDoc(doc(db, 'marketplace', 'i1'), { creatorId: 'c1', status: 'listed', title: 'Piece', stats: { buys: 0 } });
    await setDoc(doc(db, 'marketplace', 'i1', 'private', 'owner'), { makerUid: BUYER, owner_only: { fan_idea: 'x', why: 'y' } });
    await setDoc(doc(db, 'marketplace', 'i2'), { creatorId: 'c1', status: 'not_makeable', title: 'Nope' });
    await setDoc(doc(db, 'orders', 'o1'), { buyer: BUYER, storeOwner: OWNER, itemId: 'i1' });
    await uploadString(ref(ctx.storage(), PHOTO), 'jpegbytes', 'raw', { contentType: 'image/jpeg' });
  });
});
test.after(() => env.cleanup());

const anon = () => env.unauthenticatedContext();
const user = (u) => env.authenticatedContext(u);

test('users/{uid}: the owner reads it but cannot write it (role, creatorId come from the API); others cannot read', async () => {
  await assertSucceeds(getDoc(doc(user(OWNER).firestore(), 'users', OWNER)));
  await assertFails(setDoc(doc(user(OWNER).firestore(), 'users', OWNER), { role: 'creator', creatorId: 'forged' }));
  await assertFails(updateDoc(doc(user(OWNER).firestore(), 'users', OWNER), { creatorId: 'forged' }));
  await assertFails(setDoc(doc(user(BUYER).firestore(), 'users', BUYER), { role: 'fan' }));
  await assertFails(getDoc(doc(user(BUYER).firestore(), 'users', OWNER)));
  await assertFails(getDoc(doc(anon().firestore(), 'users', OWNER)));
});

test('users/{uid}/private (Instagram token): no client reads or writes it, not even the owner', async () => {
  await assertFails(getDoc(doc(user(OWNER).firestore(), 'users', OWNER, 'private', 'instagram')));
  await assertFails(setDoc(doc(user(OWNER).firestore(), 'users', OWNER, 'private', 'instagram'), { token: 'x' }));
});

test('no client writes orders (Functions only)', async () => {
  await assertFails(setDoc(doc(user(BUYER).firestore(), 'orders', 'o2'), { buyer: BUYER }));
  await assertFails(updateDoc(doc(user(BUYER).firestore(), 'orders', 'o1'), { quantity: 9 }));
});

test('retired: stores/** and public/** are gone (denied)', async () => {
  await assertFails(getDoc(doc(anon().firestore(), 'public', 's1')));
  await assertFails(getDoc(doc(user(OWNER).firestore(), 'stores', 's1')));
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

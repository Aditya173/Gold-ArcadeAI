// Firebase JS SDK: anonymous auth only, against the local auth emulator.
import { initializeApp, getApps } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously, signInWithCustomToken, signOut as fbSignOut, type User } from 'firebase/auth';

// Demo project on the emulators: no real keys needed.
const app = getApps()[0] ?? initializeApp({ apiKey: 'demo-key', projectId: 'demo-storefront', authDomain: 'demo-storefront.firebaseapp.com' });

export const auth = getAuth(app);

// Same host as the API (127.0.0.1 in the Simulator, the Mac's LAN IP via EXPO_PUBLIC_API_BASE on a phone).
const host = (process.env.EXPO_PUBLIC_API_BASE ?? '').match(/^https?:\/\/([^:/]+)/)?.[1] ?? '127.0.0.1';
try {
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
} catch {
  // already connected (fast refresh)
}

export async function signIn(): Promise<User> {
  return auth.currentUser ?? (await signInAnonymously(auth)).user;
}

export const signOut = () => fbSignOut(auth);

// Emulator only. The demo brand (Wishbone Kitchen) is owned by the seed uid (backend/scripts/seed.mjs), so
// "Use demo brand" signs in as that uid with an unsigned custom token, which only the Auth emulator accepts.
export const DEMO_CREATOR_UID = 'seed-creator-wishbonekitchen';
export async function signInAsDemoCreator(): Promise<User> {
  if (auth.currentUser?.uid === DEMO_CREATOR_UID) return auth.currentUser;
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const now = Math.floor(Date.now() / 1000);
  const iss = 'seed@demo-storefront.iam.gserviceaccount.com';
  const aud = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';
  const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ uid: DEMO_CREATOR_UID, iat: now, exp: now + 3600, aud, iss, sub: iss })}.`;
  return (await signInWithCustomToken(auth, token)).user;
}

export async function idToken(): Promise<string | null> {
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

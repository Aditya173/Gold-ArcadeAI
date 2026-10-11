// S0 app shell for the (auth) group: Stack + bottom nav (Marketplace / Made for you / My products / Sign out).
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { NavBar, type NavKey } from '../components/s0/NavBar';
import { api, ApiError, errorMessage, type Role } from '../services/api';
import { signOut } from '../services/firebase';
import { clearSession, setSession, useSession } from '../store/session';

export default function S0Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const { mine } = useGlobalSearchParams<{ mine?: string }>();
  const { uid, role, creatorId } = useSession();
  const [who, setWho] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Role from GET /users/{uid}/insights; creators also get name + @handle from GET /creators/{creatorId}.
  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const ins = await api.getInsights(uid);
      const r: Role | null = ins.role ?? role;
      const cid = r === 'creator' ? (ins.creatorId ?? creatorId) : creatorId;
      setSession({ role: r, creatorId: cid });
      if (r === 'creator' && cid) {
        const c = await api.creator(cid);
        setWho(`${c.name} @${c.handle}`);
      } else {
        setWho(r === 'creator' ? 'Creator' : 'Fan');
      }
    } catch (e) {
      // 404: signed in only to buy (no insights yet), a shopper rather than an error.
      if (e instanceof ApiError && e.status === 404) setWho('Shopper');
      else setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [uid, creatorId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (uid) load();
    else setWho(null);
  }, [uid, load]);

  const active: NavKey | null = pathname.startsWith('/marketplace')
    ? mine
      ? 'mine'
      : 'marketplace'
    : pathname.startsWith('/suggestions')
      ? 'made'
      : null;

  const onNav = (k: NavKey) => {
    if (k === 'marketplace') router.navigate('/marketplace');
    else if (k === 'mine') router.navigate({ pathname: '/marketplace', params: { mine: '1' } });
    else if (creatorId) router.navigate({ pathname: '/suggestions', params: { creatorId } });
    else router.navigate(role === 'creator' ? '/brand' : '/creators'); // no creator yet: pick / make one first
  };

  const onSignOut = async () => {
    try {
      await signOut();
    } finally {
      clearSession();
      router.replace('/');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <NavBar
        signedIn={!!uid}
        active={active}
        who={who}
        loading={loading}
        error={error}
        onNav={onNav}
        onSignIn={() => router.replace('/')}
        onSignOut={onSignOut}
      />
    </View>
  );
}

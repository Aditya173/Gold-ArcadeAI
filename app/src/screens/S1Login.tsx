// S1 Login: pick a role, anonymous sign-in, then S2. Or browse the marketplace signed out.
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, ErrorState, Screen, Segmented } from '../components/ui';
import { WelcomeHero } from '../components/s1/WelcomeHero';
import { signIn, signOut } from '../services/firebase';
import { errorMessage, type Role } from '../services/api';
import { clearSession, setSession, useSession } from '../store/session';
import { brand, space, type } from '../theme';

const COPY: Record<Role, { title: string; lead: string }> = {
  creator: { title: "Let's open your storefront", lead: 'Turn your brand into a shop full of items your audience actually wants' },
  fan: { title: "Let's go shopping", lead: 'Find and create products from your favorite people.' },
};

export default function S1Login() {
  const router = useRouter();
  const session = useSession();
  const [role, setRole] = useState<Role>(session.role ?? 'creator');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const user = await signIn();
      setSession({ uid: user.uid, role });
      router.push('/onboarding');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Next sign-in is a new anonymous uid (the fan is a different user from the creator).
  const switchRole = async () => {
    setBusy(true);
    setError(null);
    try {
      await signOut();
      clearSession();
      const user = await signIn();
      setSession({ uid: user.uid, role: null, creatorId: null });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<Text style={[type.wordmark, { paddingTop: space.md, paddingLeft: type.wordmark.letterSpacing }]}>{brand}</Text>}
      contentStyle={{ paddingHorizontal: space.xl2 }}
      footer={
        <>
          <Button title={busy ? 'Signing in…' : "Let's go"} onPress={go} loading={busy} />
          <Button title="Browse the marketplace" variant="ghost" onPress={() => router.push('/marketplace')} />
          {session.uid ? <Button title="Sign out / switch role" variant="ghost" size="sm" onPress={switchRole} disabled={busy} /> : null}
        </>
      }
    >
      <WelcomeHero role={role} />
      <Segmented
        options={[
          { value: 'creator', label: "I'm a creator" },
          { value: 'fan', label: "I'm a fan" },
        ]}
        value={role}
        onChange={setRole}
        style={{ marginBottom: space.xl4 - space.lg }}
      />
      <View style={{ gap: space.xl }}>
        <Text style={type.display}>{COPY[role].title}</Text>
        <Text style={type.lead}>{COPY[role].lead}</Text>
      </View>
      {error ? <ErrorState title="Sign-in failed" message={error} onRetry={go} /> : null}
    </Screen>
  );
}

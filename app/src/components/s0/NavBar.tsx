// S0 bottom nav: who is signed in (avatar + name, or the FAN-MADE wordmark signed out) + the way back to every main screen.
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip } from '../ui';
import { brand, colors, shadows, space, type } from '../../theme';

export type NavKey = 'marketplace' | 'made' | 'mine';

export function NavBar({
  signedIn,
  active,
  who,
  loading,
  error,
  onNav,
  onSignIn,
  onSignOut,
}: {
  signedIn: boolean;
  active: NavKey | null;
  who: string | null;
  loading: boolean;
  error: string | null;
  onNav: (k: NavKey) => void;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  const insets = useSafeAreaInsets();
  const items: { key: NavKey; label: string }[] = signedIn
    ? [
        { key: 'marketplace', label: 'Marketplace' },
        { key: 'made', label: 'Made for you' },
        { key: 'mine', label: 'My products' },
      ]
    : [{ key: 'marketplace', label: 'Marketplace' }];
  return (
    <View
      style={{
        paddingHorizontal: space.l,
        paddingTop: space.md,
        paddingBottom: Math.max(insets.bottom, space.md),
        gap: space.sm,
        backgroundColor: colors.glassStrong,
        borderTopWidth: 1,
        borderTopColor: colors.hairline,
        ...shadows.soft,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, minHeight: 34 }}>
        {signedIn && !error ? (
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.tile, alignItems: 'center', justifyContent: 'center' }}>
            {loading && !who ? <ActivityIndicator size="small" color={colors.muted} /> : <Text style={type.bodyEmphasis}>{(who ?? '·').charAt(0).toUpperCase()}</Text>}
          </View>
        ) : null}
        {error ? (
          <Text numberOfLines={1} style={[type.caption, { flex: 1, color: colors.danger }]}>
            {error}
          </Text>
        ) : signedIn ? (
          <Text numberOfLines={1} style={[type.storeName, { flex: 1 }]}>
            {who ?? (loading ? 'Reading your profile…' : 'Signed in')}
          </Text>
        ) : (
          <Text style={[type.wordmark, { flex: 1, textAlign: 'left' }]}>{brand}</Text>
        )}
        <Button title={signedIn ? 'Sign out / switch role' : 'Sign in'} variant="ghost" size="sm" onPress={signedIn ? onSignOut : onSignIn} />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {items.map((it) => (
          <Chip
            key={it.key}
            label={it.label}
            selected={active === it.key}
            onPress={() => onNav(it.key)}
            style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.md }}
          />
        ))}
      </View>
    </View>
  );
}

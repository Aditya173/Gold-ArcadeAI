import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { colors, fontAssets } from '../src/theme';
import { auth } from '../src/services/firebase';
import { setSession } from '../src/store/session';

export default function RootLayout() {
  const [loaded, error] = useFonts(fontAssets);
  useEffect(() => onAuthStateChanged(auth, (u) => setSession({ uid: u?.uid ?? null })), []);
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </SafeAreaProvider>
  );
}

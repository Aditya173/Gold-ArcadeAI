// S9 Buy / checkout (brief 1.1 S9, docs/design/SCREENS.md "S9"). Nobody pays: mock never opens checkoutUrl.
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Button, Card, ErrorState, Header, ImageTile, LoadingState, Screen } from '../components/ui';
import { PriceTag, priceText, useAccent } from '../components/s7/shared';
import { api, errorMessage, type BuyResponse, type Item } from '../services/api';
import { signIn } from '../services/firebase';
import { colors, radii, space, type } from '../theme';

export default function S9Checkout() {
  const { itemId, quantity } = useLocalSearchParams<{ itemId: string; quantity?: string }>();
  const qty = Math.min(10, Math.max(1, parseInt(quantity ?? '1', 10) || 1));
  const [item, setItem] = useState<Item | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [buyErr, setBuyErr] = useState<string | null>(null);
  const [done, setDone] = useState<BuyResponse | null>(null);
  const accent = useAccent(item?.creatorId);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      setItem(await api.item(String(itemId)));
    } catch (e) {
      setLoadErr(errorMessage(e));
    }
  }, [itemId]);

  useEffect(() => {
    load();
  }, [load]);

  const pay = async () => {
    setBusy(true);
    setBuyErr(null);
    try {
      await signIn(); // silent anonymous sign-in if signed out
      const r = await api.buy(String(itemId), qty);
      setDone(r);
      // Hand-off only on live Arcade. On the mock the URL is fake: never open it.
      if (r.mock === false && r.checkoutUrl) await WebBrowser.openBrowserAsync(r.checkoutUrl);
    } catch (e) {
      setBuyErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const toMarket = () => router.navigate('/marketplace');
  const header = <Header variant="store" title="Checkout" onBack={() => (router.canGoBack() ? router.back() : toMarket())} />;

  if (loadErr) return <Screen variant="store" header={header}><ErrorState message={loadErr} onRetry={load} /></Screen>;
  if (!item) return <Screen variant="store" header={header}><LoadingState label="Loading order…" /></Screen>;

  return (
    <Screen
      variant="store"
      header={header}
      footer={
        <View style={{ flexDirection: 'row', gap: space.lg }}>
          <Button title={done ? 'Marketplace' : 'Back'} variant="secondary" onPress={done ? toMarket : () => router.back()} style={{ flex: 1 }} />
          <Button
            title={done ? 'Checkout created ✓' : busy ? 'Creating checkout…' : 'Continue to payment'}
            variant="accent"
            color={accent}
            loading={busy}
            disabled={!!done}
            onPress={pay}
            style={{ flex: 1.6 }}
          />
        </View>
      }
    >
      <ImageTile uri={item.imageUrl} label={item.title ?? item.category} radius={radii.hero} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.xl }}>
        <Text style={[type.heading, { flex: 1 }]}>{item.title ?? 'Untitled'}</Text>
        <PriceTag price={item.price} />
      </View>
      <Text style={type.caption}>
        Quantity {qty} · {priceText(item.price)}
        {item.price ? ' each' : ''}
        {item.price?.mock ? ' (estimate)' : ''}
      </Text>

      {buyErr ? <ErrorState title="Couldn't create checkout" message={buyErr} onRetry={pay} /> : null}

      {done ? (
        <Card>
          <View style={{ gap: space.sm }} accessibilityRole="summary">
            <Text style={type.bodyStrong}>Checkout created</Text>
            {done.mock ? <Text style={type.body}>Demo checkout created, no payment taken</Text> : <Text style={type.body}>Payment page opened in your browser.</Text>}
            <Text style={[type.caption, { color: colors.ink }]}>Order reference: {done.orderId}</Text>
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

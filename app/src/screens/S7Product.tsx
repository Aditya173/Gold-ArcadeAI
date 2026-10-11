// S7 Product detail (brief 1.1 S7, docs/design/SCREENS.md "S7").
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, Chip, EmptyState, ErrorState, Header, ImageTile, LoadingState, Screen } from '../components/ui';
import { PriceTag, useAccent } from '../components/s7/shared';
import { api, ApiError, errorMessage, type Item, type Reason } from '../services/api';
import { signIn } from '../services/firebase';
import { colors, fonts, radii, space, type } from '../theme';

type Owner = { why?: string | null; reasons?: Reason[] };

export default function S7Product() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const [item, setItem] = useState<Item | null>(null);
  const [err, setErr] = useState<ApiError | Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [shown, setShown] = useState(0);
  const [qty, setQty] = useState(1);
  const [buying, setBuying] = useState(false);
  const [buyErr, setBuyErr] = useState<string | null>(null);
  const accent = useAccent(item?.creatorId);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      setItem(await api.item(String(itemId)));
    } catch (e) {
      setErr(e as Error);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    load();
  }, [load]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/marketplace'));
  const header = <Header variant="store" onBack={back} title={item?.creatorName ?? 'Product'} />;

  if (loading && !item) return <Screen variant="store" header={header}><LoadingState label="Loading product…" /></Screen>;
  if (err && (err as ApiError).status === 404)
    return (
      <Screen variant="store" header={header}>
        <EmptyState title="This product is no longer available" actionLabel="Back to marketplace" onAction={() => router.replace('/marketplace')} />
      </Screen>
    );
  if (err || !item)
    return <Screen variant="store" header={header}><ErrorState message={err ? errorMessage(err) : 'No product.'} onRetry={load} /></Screen>;

  const gallery = [...new Set([item.imageUrl, ...(item.images ?? [])].filter((u): u is string => !!u))];
  const owner = (item.mine ? item.owner : undefined) as Owner | undefined;
  const reasons = owner?.reasons ?? [];
  const creatorLink = () =>
    item.creatorId &&
    router.push({ pathname: '/marketplace', params: { creatorId: item.creatorId, creatorName: item.creatorName ?? '' } });

  const buy = async () => {
    setBuying(true);
    setBuyErr(null);
    try {
      await signIn(); // silent anonymous sign-in, no onboarding
      router.push({ pathname: '/checkout/[itemId]', params: { itemId: item.itemId, quantity: String(qty) } });
    } catch (e) {
      setBuyErr(errorMessage(e));
    } finally {
      setBuying(false);
    }
  };

  return (
    <Screen
      variant="store"
      header={header}
      footer={
        <>
          {buyErr ? <Text style={[type.caption, { color: colors.danger }]}>{buyErr}</Text> : null}
          <View style={{ flexDirection: 'row', gap: space.lg }}>
            <Button title="Back" variant="secondary" onPress={back} style={{ flex: 1 }} />
            <Button title="Buy now" variant="accent" color={accent} loading={buying} onPress={buy} style={{ flex: 1.6 }} />
          </View>
        </>
      }
    >
      <ImageTile uri={gallery[shown] ?? null} label={item.title ?? item.category} radius={radii.hero} />
      {gallery.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
          {gallery.map((u, i) => (
            <Pressable key={u} onPress={() => setShown(i)} accessibilityRole="button" accessibilityLabel={`Image ${i + 1}`}>
              <ImageTile uri={u} radius={radii.md} selected={i === shown} style={{ width: 64 }} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.xl }}>
        <Text style={[type.heading, { flex: 1 }]}>{item.title ?? 'Untitled'}</Text>
        <PriceTag price={item.price} />
      </View>
      {item.selectionLabel ? <Text style={type.label}>{item.selectionLabel}</Text> : null}

      <View style={{ gap: space.sm }}>
        {item.maker === 'fan' ? <Badge label="Fan edition" tone="ink" /> : null}
        <Text style={type.body}>
          {item.maker === 'fan' ? 'fan edition, made in ' : 'by '}
          <Text onPress={creatorLink} accessibilityRole="link" style={{ fontFamily: fonts.semibold, color: colors.ink, textDecorationLine: 'underline' }}>
            {item.creatorName ?? 'the creator'}
          </Text>
          {item.maker === 'fan' ? "'s style" : ''}
          {item.creatorHandle ? <Text style={type.caption}>{`  @${item.creatorHandle.replace(/^@/, '')}`}</Text> : null}
        </Text>
        {item.mine ? <Badge label="Yours" tone="lemon" /> : null}
      </View>

      {item.public_tag ? <Chip label={item.public_tag} variant="tag" /> : null}
      {item.description ? <Text style={type.body}>{item.description}</Text> : null}

      <View style={{ gap: space.xs }}>
        <Row k="Category" v={item.category} />
        {item.makerName ? <Row k="Manufacturer" v={item.makerName} /> : null}
        <Row k="Times bought" v={String(item.stats?.buys ?? 0)} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xl }}>
        <Text style={type.label}>Quantity</Text>
        <Button title="−" variant="secondary" size="sm" disabled={qty <= 1} onPress={() => setQty((q) => Math.max(1, q - 1))} />
        <Text style={[type.bodyStrong, { minWidth: 24, textAlign: 'center' }]} accessibilityLabel={`Quantity ${qty}`}>
          {qty}
        </Text>
        <Button title="+" variant="secondary" size="sm" disabled={qty >= 10} onPress={() => setQty((q) => Math.min(10, q + 1))} />
      </View>

      {owner && (owner.why || reasons.length) ? (
        <Card>
          <View style={{ gap: space.md }}>
            <Text style={type.bodyStrong}>Why we chose this</Text>
            {owner.why ? <Text style={type.body}>{owner.why}</Text> : null}
            {reasons.map((r, i) => (
              <Text key={i} style={type.body}>
                • {r.text}
              </Text>
            ))}
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <Text style={type.caption}>
      {k}: <Text style={{ color: colors.ink }}>{v}</Text>
    </Text>
  );
}

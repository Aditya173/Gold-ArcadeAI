// S8 Universal marketplace (brief 1.1 S8, docs/design/SCREENS.md "S8"). Works signed out.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Card, Chip, EmptyState, ErrorState, Header, LoadingState, Screen, Section, Segmented } from '../components/ui';
import { ProductCard } from '../components/s8/ProductCard';
import { api, errorMessage, type CreatorSummary, type Item, type Maker, type Sort } from '../services/api';
import { useSession } from '../store/session';
import { colors, fonts, radii, space, type } from '../theme';

type P = { creatorId?: string; creatorName?: string; category?: string; maker?: string; mine?: string };

export default function S8Marketplace() {
  const p = useLocalSearchParams<P>();
  const session = useSession();
  const [sort, setSort] = useState<Sort>('new');
  const [creatorId, setCreatorId] = useState(p.creatorId || undefined);
  const [category, setCategory] = useState(p.category || undefined);
  const [maker, setMaker] = useState<Maker | undefined>(p.maker === 'creator' || p.maker === 'fan' ? p.maker : undefined);
  const mineOnly = p.mine === '1';
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creators, setCreators] = useState<CreatorSummary[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Deep links (S7 creator link, S0 nav) change params on an already-mounted screen.
  useEffect(() => {
    setCreatorId(p.creatorId || undefined);
    setCategory(p.category || undefined);
    setMaker(p.maker === 'creator' || p.maker === 'fan' ? p.maker : undefined);
  }, [p.creatorId, p.category, p.maker]);

  useEffect(() => {
    api.creators().then((r) => setCreators(r.creators)).catch(() => {});
  }, []);

  // Fresh fetch every time (Arcade image URLs expire; never cached).
  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await api.marketplace({ sort, creatorId, category, maker });
      setItems(r.items);
      setCategories((cs) => [...new Set([...cs, ...r.items.map((i) => i.category)])].sort());
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [sort, creatorId, category, maker, session.uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const shown = items ? (mineOnly ? items.filter((i) => i.mine) : items) : null;
  const creatorName =
    creators.find((c) => c.creatorId === creatorId)?.name ?? (creatorId === p.creatorId ? p.creatorName : undefined) ?? creatorId;
  const canDesign = session.uid && session.role === 'fan' && session.creatorId;
  // "Design your own" card: the fan's creator palette accent (from the creators list already loaded), ink until known.
  const myCreator = creators.find((c) => c.creatorId === session.creatorId);
  const accent = (myCreator?.palette.find((x) => x.role === 'accent') ?? myCreator?.palette.find((x) => x.role === 'primary'))?.hex ?? colors.ink;

  return (
    <Screen
      variant="store"
      header={
        <Header
          variant="store"
          avatar={creatorId && !mineOnly ? null : undefined}
          title={mineOnly ? 'My products' : creatorId ? creatorName : 'Marketplace'}
          right={shown ? <Text style={type.caption}>{`${shown.length} products`}</Text> : null}
        />
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {canDesign ? (
        <Card
          variant="solid"
          padded={false}
          onPress={() => router.push('/suggestions')}
          style={{ borderRadius: radii.card, backgroundColor: accent, paddingVertical: 18, paddingHorizontal: space.gutter }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.xl }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[type.bodyStrong, { fontFamily: fonts.bold, color: colors.white }]}>Design your own</Text>
              <Text style={[type.caption, { color: colors.white, opacity: 0.85 }]}>
                {`Create your own products in ${myCreator?.name ?? 'your creator'}’s style`}
              </Text>
            </View>
            <Text style={{ fontSize: 22, color: colors.white }}>→</Text>
          </View>
        </Card>
      ) : null}

      <Section>
        <Text style={[type.bodyStrong, { fontFamily: fonts.bold, marginTop: space.xs }]}>Shop the collection</Text>
        <Segmented
          options={[
            { value: 'new', label: 'Newest' },
            { value: 'popular', label: 'Most bought' },
          ]}
          value={sort}
          onChange={setSort}
        />
        <Filters label="Creator">
          <Chip variant="outline" label="All" selected={!creatorId} onPress={() => setCreatorId(undefined)} />
          {creatorId && !creators.some((c) => c.creatorId === creatorId) ? (
            <Chip variant="outline" label={creatorName ?? ''} selected onPress={() => setCreatorId(undefined)} />
          ) : null}
          {creators.map((c) => (
            <Chip
              key={c.creatorId}
              variant="outline"
              label={c.name}
              selected={creatorId === c.creatorId}
              onPress={() => setCreatorId(creatorId === c.creatorId ? undefined : c.creatorId)}
            />
          ))}
        </Filters>
        <Filters label="Category">
          <Chip variant="outline" label="All" selected={!category} onPress={() => setCategory(undefined)} />
          {(category && !categories.includes(category) ? [category, ...categories] : categories).map((c) => (
            <Chip key={c} variant="outline" label={c} selected={category === c} onPress={() => setCategory(category === c ? undefined : c)} />
          ))}
        </Filters>
        <Filters label="Made by">
          <Chip variant="outline" label="All" selected={!maker} onPress={() => setMaker(undefined)} />
          <Chip variant="outline" label="Creator" selected={maker === 'creator'} onPress={() => setMaker(maker === 'creator' ? undefined : 'creator')} />
          <Chip variant="outline" label="Fan" selected={maker === 'fan'} onPress={() => setMaker(maker === 'fan' ? undefined : 'fan')} />
        </Filters>
      </Section>

      {err && !shown ? (
        <ErrorState message={err} onRetry={load} />
      ) : !shown ? (
        <LoadingState label="Loading products…" />
      ) : (
        <>
          {err ? <Text style={[type.caption, { color: colors.danger }]}>{err}</Text> : null}
          {shown.length === 0 ? (
            <EmptyState
              title="No products yet"
              message={creatorId || category || maker || mineOnly ? 'Nothing matches these filters.' : undefined}
              actionLabel={creatorId || category || maker ? 'Clear filters' : undefined}
              onAction={() => {
                setCreatorId(undefined);
                setCategory(undefined);
                setMaker(undefined);
              }}
            />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.l }}>
              {shown.map((it) => (
                <ProductCard
                  key={it.itemId}
                  item={it}
                  onPress={() => router.push({ pathname: '/product/[itemId]', params: { itemId: it.itemId } })}
                />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function Filters({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[type.label, { paddingHorizontal: space.xs }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingVertical: space.xxs }}>
        {children}
      </ScrollView>
    </View>
  );
}

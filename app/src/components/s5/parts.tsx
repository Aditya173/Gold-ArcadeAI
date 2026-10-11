// S5 private pieces: creator result card + selected creator's listed-products preview.
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api, errorMessage, type CreatorSummary, type Item, type PaletteEntry, type Price } from '../../services/api';
import { Badge, Card, EmptyState, ErrorState, ImageTile, LoadingState, PaletteStrip, Section } from '../ui';
import { colors, space, type } from '../../theme';

export const accentOf = (palette: PaletteEntry[] = []) =>
  (palette.find((p) => /accent/i.test(p.role ?? '')) ?? palette[0])?.hex ?? colors.ink;

export function PriceLine({ price }: { price: Price | null }) {
  if (!price) return <Text style={[type.body, { color: colors.muted2 }]}>Price on request</Text>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Text style={type.body}>
        {String(price.amount)} {price.currency}
      </Text>
      {price.mock ? <Badge label="estimate" tone="lemon" /> : null}
    </View>
  );
}

export function CreatorCard({ c, selected, onPress }: { c: CreatorSummary; selected: boolean; onPress: () => void }) {
  return (
    <Card selected={selected} onPress={onPress} style={{ gap: space.lg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md }}>
        <View style={{ flexShrink: 1 }}>
          <Text numberOfLines={1} style={type.bodyStrong}>
            {c.name}
          </Text>
          <Text numberOfLines={1} style={type.caption}>
            @{c.handle.replace(/^@/, '')}
          </Text>
        </View>
        <Text style={[type.caption, { color: colors.muted2 }]}>
          {c.listedCount} {c.listedCount === 1 ? 'product' : 'products'}
        </Text>
      </View>
      {c.palette?.length ? <PaletteStrip colors={c.palette.map((p) => p.hex)} height={20} /> : null}
    </Card>
  );
}

export function CreatorPreview({ creator }: { creator: CreatorSummary }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setItems(null);
    setError(null);
    api
      .marketplace({ creatorId: creator.creatorId, maker: 'creator' })
      .then((r) => live && setItems(r.items.slice(0, 4)))
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [creator.creatorId, nonce]);

  return (
    <Section title={`${creator.name}'s shop`} right={items ? `${items.length} shown` : undefined}>
      {error ? (
        <ErrorState message={error} onRetry={() => setNonce((n) => n + 1)} />
      ) : !items ? (
        <LoadingState label="Loading their products…" />
      ) : items.length === 0 ? (
        <EmptyState title="No products yet" message={`${creator.name} hasn't listed anything yet.`} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.l, columnGap: space.xl }}>
          {items.map((it) => (
            <View key={it.itemId} style={{ width: '47%', gap: space.xs }}>
              <ImageTile uri={it.imageUrl} label={it.category} aspectRatio={4 / 5} />
              <Text numberOfLines={1} style={type.bodyEmphasis}>
                {it.title ?? it.category}
              </Text>
              <PriceLine price={it.price} />
            </View>
          ))}
        </View>
      )}
    </Section>
  );
}

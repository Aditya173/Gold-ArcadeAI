// S6 private pieces: per-item suggestion card (+ owner-only "Why we chose this"), camera-roll strip, style used.
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Creator, Item, Reading } from '../../services/api';
import { Badge, Chip, ImageTile, PaletteStrip, Section } from '../ui';
import { PriceLine } from '../s5/parts';
import { colors, radii, space, type } from '../../theme';

export const pct = (share: number) => `${Math.round(share <= 1 ? share * 100 : share)}%`;

export function CameraRollStrip({ reading }: { reading: Reading }) {
  const top = reading.signature.slice(0, 3);
  const hexes = reading.palette.map((p) => p.hex);
  return (
    <Section title="What we used from your camera roll" right="only you see this">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        {top.map((s) => (
          <Chip key={s.idea} label={s.idea} note={pct(s.share_of_events)} />
        ))}
      </View>
      {hexes.length ? <PaletteStrip colors={hexes} height={24} /> : null}
    </Section>
  );
}

/** words=false when the screen already shows the style words as guardrail chips (fan create look). */
export function StyleUsed({ creator, words = true }: { creator: Creator; words?: boolean }) {
  const thumbs = creator.styleThumbs ?? [];
  return (
    <Section title={`${creator.name}'s style`}>
      {creator.palette?.length ? <PaletteStrip colors={creator.palette.map((p) => p.hex)} height={24} /> : null}
      {words && creator.styleWords?.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {creator.styleWords.map((w) => (
            <Chip key={w} label={w} variant="tag" />
          ))}
        </View>
      ) : null}
      {thumbs.length ? (
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {thumbs.slice(0, 3).map((u, i) => (
            <ImageTile key={`${u}-${i}`} uri={u} label="reference" style={{ flex: 1 }} radius={12} />
          ))}
        </View>
      ) : (
        <Text style={type.caption}>3 reference images</Text>
      )}
    </Section>
  );
}

function WhyChose({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);
  const reasons = item.reasons ?? [];
  if (!reasons.length && !item.why) return null;
  return (
    <View style={{ gap: space.sm }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={6}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}
      >
        <Text style={[type.label, { color: colors.ink }]}>Why we chose this</Text>
        <Text style={[type.label, { color: colors.ink, transform: [{ rotate: open ? '90deg' : '0deg' }] }]}>›</Text>
      </Pressable>
      {open ? (
        <View style={{ gap: space.md }}>
          {item.why ? <Text style={[type.caption, { color: colors.inkSoft }]}>{item.why}</Text> : null}
          {reasons.map((r, i) => (
            <View key={`${r.kind}-${i}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.lg }}>
              <View style={{ width: 24, height: 24, borderRadius: radii.xs, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lemon, borderWidth: 1, borderColor: colors.dashedStrong }}>
                <Text style={[type.badge, { fontSize: 13 }]}>✓</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={type.bodyEmphasis}>{r.kind}</Text>
                <Text style={type.caption}>{r.text}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function SuggestionCard({
  item,
  creatorName,
  onOpen,
  store,
}: {
  /** null = placeholder while POST /suggest runs and GET /suggestions hasn't caught up. */
  item: Item | null;
  creatorName: string;
  onOpen: (itemId: string) => void;
  /** Fan (storefront) look: warm dashed slot + unframed tile; creator gets the studio "make" grid look. */
  store?: boolean;
}) {
  if (!item || item.status === 'generating') {
    return (
      <View style={{ width: '47%', gap: space.xs }}>
        <ImageTile
          status="generating"
          variant={store ? 'store' : 'studio'}
          label={store ? 'Designing your piece…' : 'Designing…'}
          aspectRatio={1}
        />
        <Text numberOfLines={1} style={[type.bodyEmphasis, { marginTop: space.xs }]}>
          {item?.category ?? 'Product'}
        </Text>
      </View>
    );
  }
  if (item.status === 'not_makeable') {
    return (
      <View style={{ width: '47%', gap: space.xs }}>
        <ImageTile label={item.category} aspectRatio={1} framed={!store} />
        <Text numberOfLines={1} style={type.bodyEmphasis}>
          {item.title ?? item.category}
        </Text>
        <Badge label="not makeable" tone="danger" />
        {item.reason ? <Text style={type.caption}>{item.reason}</Text> : null}
      </View>
    );
  }
  return (
    <View style={{ width: '47%', gap: space.sm }}>
      <Pressable onPress={() => onOpen(item.itemId)} accessibilityRole="button" accessibilityLabel={`Open ${item.title ?? item.category}`} style={{ gap: space.xs }}>
        <ImageTile uri={item.imageUrl} label={item.category} aspectRatio={1} framed={!store}>
          <Badge label="listed" tone="lemon" style={{ position: 'absolute', top: space.md, left: space.md }} />
        </ImageTile>
        <Text numberOfLines={2} style={[type.bodyEmphasis, { marginTop: space.xs }]}>
          {item.title ?? item.category}
        </Text>
        <PriceLine price={item.price} />
        <Text style={[type.caption, { color: colors.muted2 }]}>{item.category}</Text>
        {item.description ? (
          <Text numberOfLines={3} style={type.caption}>
            {item.description}
          </Text>
        ) : null}
        {item.maker === 'fan' ? (
          <Badge label={`fan edition · ${creatorName}'s style`} tone="ink" />
        ) : (
          <Text style={type.caption}>by {creatorName}</Text>
        )}
      </Pressable>
      <WhyChose item={item} />
    </View>
  );
}

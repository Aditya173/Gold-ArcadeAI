// S2 pieces (Fan-Made "info" + "vibes"): connect rows, demo profile card, and the "What Gold found" vibes moment.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Badge, Button, Card, Chip, PaletteStrip } from '../ui';
import type { Pack, Reading } from '../../services/api';
import { colors, space, type } from '../../theme';

/** Line icons from the design, drawn with views (no SVG). */
function ConnectIcon({ kind }: { kind: 'photos' | 'instagram' }) {
  const line = { borderWidth: 1.8, borderColor: colors.ink } as const;
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      {kind === 'photos' ? (
        <View style={[line, { width: 20, height: 17, borderRadius: 4 }]}>
          <View style={[line, { position: 'absolute', left: 3, top: 3, width: 5, height: 5, borderRadius: 2.5 }]} />
          <View style={{ position: 'absolute', right: 1, bottom: 4, width: 11, height: 1.8, backgroundColor: colors.ink, transform: [{ rotate: '-40deg' }] }} />
        </View>
      ) : (
        <View style={[line, { width: 19, height: 19, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }]}>
          <View style={[line, { width: 9, height: 9, borderRadius: 4.5 }]} />
          <View style={{ position: 'absolute', right: 2, top: 2, width: 2.4, height: 2.4, borderRadius: 1.2, backgroundColor: colors.ink }} />
        </View>
      )}
    </View>
  );
}

export function ConnectRow({
  icon,
  title,
  sub,
  done,
  onConnect,
  last,
}: {
  icon: 'photos' | 'instagram';
  title: string;
  sub: string;
  done: boolean;
  onConnect?: () => void;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xl,
        paddingVertical: space.xxl,
        paddingHorizontal: space.l,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.hairline,
      }}
    >
      <ConnectIcon kind={icon} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={type.bodyStrong}>{title}</Text>
        <Text numberOfLines={1} style={type.caption}>
          {sub}
        </Text>
      </View>
      <View style={{ width: 92, height: 32, alignItems: 'flex-end', justifyContent: 'center' }}>
        {done ? (
          <View
            accessibilityLabel={`${title} connected`}
            style={{ width: 28, height: 28, borderRadius: 14, marginRight: 2, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={[type.badge, { color: colors.lemon }]}>✓</Text>
          </View>
        ) : onConnect ? (
          <Button title="Connect" variant="dark" size="sm" onPress={onConnect} />
        ) : null}
      </View>
    </View>
  );
}

/** Card footer row: "Why connect?" + chevron, expands to the explanation. */
export function WhyConnect({ text, note }: { text: string; note?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.hairline }}>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xl, paddingHorizontal: space.l }}
      >
        <Text style={type.label}>Why connect?</Text>
        <Text style={[type.label, { transform: [{ rotate: open ? '-90deg' : '90deg' }] }]}>›</Text>
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: space.l, paddingBottom: space.xxl, gap: space.sm }}>
          <Text style={[type.caption, { color: colors.inkSoft }]}>{text}</Text>
          <Text style={type.caption}>Your photos stay private and nothing gets posted.</Text>
          {note ? <Text style={type.caption}>{note}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

export function PackCard({ pack, selected, onPress }: { pack: Pack; selected: boolean; onPress: () => void }) {
  const ideas = (pack.ideas ?? []).slice(0, 3);
  return (
    <Card selected={selected} onPress={onPress} style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md }}>
        <Text style={[type.bodyStrong, { flexShrink: 1 }]}>{pack.name ?? pack.id}</Text>
        {pack.photos ? <Text style={type.caption}>{pack.photos.count} photos</Text> : null}
      </View>
      {pack.oneLine ? <Text style={type.caption}>{pack.oneLine}</Text> : null}
      {ideas.length ? <Text style={[type.caption, { color: colors.inkSoft }]}>{ideas.join(' · ')}</Text> : null}
      {pack.palette?.length ? <PaletteStrip colors={pack.palette} height={20} /> : null}
    </Card>
  );
}

const TILTS = [-4, 3, -2, 4, -3];

/** Private to the user: the vibes moment, top ideas pop in 600ms apart (design "vibes"). */
export function GoldFound({ reading }: { reading: Reading }) {
  const top = [...reading.signature].sort((a, b) => b.share_of_events - a.share_of_events).slice(0, 5);
  const hexes = reading.palette.map((p) => p.hex);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    const id = setInterval(() => setShown((n) => (n >= top.length ? n : n + 1)), 600);
    return () => clearInterval(id);
  }, [reading]); // eslint-disable-line react-hooks/exhaustive-deps
  const seeing = shown < Math.min(3, top.length);
  return (
    <View style={{ gap: space.xl, marginTop: space.l }}>
      <Text style={type.headline}>{seeing ? 'Seeing your viewpoint…' : 'Finding what you love…'}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', rowGap: space.xxl, columnGap: space.lg, paddingVertical: space.gutter }}>
        {top.slice(0, shown).map((s, i) => (
          <Chip
            key={s.idea}
            label={s.idea}
            note={`${Math.round(s.share_of_events * 100)}%`}
            dot={hexes[i % Math.max(hexes.length, 1)] ?? colors.lemon}
            tilt={TILTS[i]}
            size="lg"
          />
        ))}
      </View>
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md }}>
          <Text style={[type.label, { flexShrink: 1 }]}>What Gold found · only you see this</Text>
          {reading.stub ? <Badge label="Synthetic demo data" /> : null}
        </View>
        {reading.archetype ? (
          <View style={{ gap: space.xxs }}>
            <Text style={type.bodyStrong}>{reading.archetype.name}</Text>
            <Text style={type.caption}>{reading.archetype.one_line}</Text>
          </View>
        ) : null}
        {hexes.length ? <PaletteStrip colors={hexes} /> : null}
      </Card>
    </View>
  );
}

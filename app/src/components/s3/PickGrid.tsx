// 3-column grid of image tiles. Selected tiles get the ink border + numbered badge top-right (design: "n of 3");
// unpicked tiles show an empty ring there; the remove x sits top-left.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ImageTile } from '../ui';
import { colors, radii, space, type } from '../../theme';

export interface PickTile {
  key: string;
  uri?: string | null;
  label?: string;
}

export function PickGrid({
  tiles,
  selected,
  onToggle,
  onRemove,
  max,
}: {
  tiles: PickTile[];
  /** keys in pick order; the badge shows 1-based position. */
  selected: string[];
  onToggle?: (key: string) => void;
  onRemove?: (key: string) => void;
  /** Once this many are picked, unpicked tiles dim (design: others at .5 when 3 picked). */
  max?: number;
}) {
  const full = max !== undefined && selected.length >= max;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {tiles.map((t) => {
        const n = selected.indexOf(t.key) + 1;
        return (
          <Pressable
            key={t.key}
            onPress={onToggle ? () => onToggle(t.key) : undefined}
            accessibilityRole={onToggle ? 'button' : undefined}
            accessibilityState={{ selected: n > 0 }}
            accessibilityLabel={t.label}
            style={{ width: '31.5%', opacity: n > 0 || !full ? 1 : 0.5 }}
          >
            <ImageTile uri={t.uri} label={t.label} radius={radii.md} selected={n > 0}>
              {n > 0 ? (
                <View style={badge}>
                  <Text style={[type.badge, { color: colors.lemon }]}>{n}</Text>
                </View>
              ) : onToggle ? (
                <View style={ring} />
              ) : null}
              {onRemove ? (
                <Pressable onPress={() => onRemove(t.key)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${t.label ?? 'image'}`} style={remove}>
                  <Text style={[type.badge, { color: colors.white }]}>×</Text>
                </Pressable>
              ) : null}
            </ImageTile>
          </Pressable>
        );
      })}
    </View>
  );
}

const badge = {
  position: 'absolute' as const,
  top: space.sm,
  right: space.sm,
  width: 22,
  height: 22,
  borderRadius: 11,
  backgroundColor: colors.ink,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
// Unpicked: empty white ring where the number goes.
const ring = { ...badge, backgroundColor: colors.glassSelected, borderWidth: 1.5, borderColor: colors.dashedStrong };
const remove = { ...badge, right: undefined, left: space.sm, backgroundColor: colors.scrim };

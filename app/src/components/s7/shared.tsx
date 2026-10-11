// Shared by S7/S8/S9: price line (brief 1.0) and the creator's accent colour for the Buy CTA.
import { useEffect, useState } from 'react';
import { Text, View, type StyleProp, type TextStyle } from 'react-native';
import { Badge } from '../ui';
import { api, type Price } from '../../services/api';
import { colors, space, type } from '../../theme';

export const priceText = (p: Price | null) =>
  !p ? 'Price on request' : p.currency === 'USD' ? `$${p.amount}` : `${p.amount} ${p.currency}`;

/** "Price on request" when null; "estimate" badge when price.mock. */
export function PriceTag({ price, style }: { price: Price | null; style?: StyleProp<TextStyle> }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
      <Text style={[type.bodyStrong, !price && { color: colors.muted }, style]}>{priceText(price)}</Text>
      {price?.mock ? <Badge label="estimate" tone="lemon" /> : null}
    </View>
  );
}

/** Creator palette accent (role accent, else primary), ink until loaded or on error. */
export function useAccent(creatorId?: string) {
  const [accent, setAccent] = useState<string>(colors.ink);
  useEffect(() => {
    if (!creatorId) return;
    let live = true;
    api
      .creator(creatorId)
      .then((c) => {
        const p = c.palette ?? [];
        const hex = (p.find((x) => x.role === 'accent') ?? p.find((x) => x.role === 'primary'))?.hex;
        if (live && hex) setAccent(hex);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [creatorId]);
  return accent;
}

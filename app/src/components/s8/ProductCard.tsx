// S8 grid card: image, title, price, creator name, Fan edition / Yours badges, times bought. No `why` here (public).
import { Pressable, Text, View } from 'react-native';
import { Badge, ImageTile } from '../ui';
import { priceText } from '../s7/shared';
import type { Item } from '../../services/api';
import { colors, radii, space, type } from '../../theme';

export function ProductCard({ item, onPress }: { item: Item; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={item.title ?? 'Product'} style={{ width: '48%', gap: space.xs }}>
      <ImageTile uri={item.imageUrl} label={item.category} aspectRatio={4 / 5} radius={radii.lg}>
        <View style={{ position: 'absolute', top: space.md, left: space.md, gap: space.xs }}>
          {item.maker === 'fan' ? <Badge label="Fan edition" tone="ink" /> : null}
          {item.mine ? <Badge label="Yours" tone="lemon" /> : null}
        </View>
      </ImageTile>
      <Text numberOfLines={2} style={[type.bodyEmphasis, { marginTop: space.xs }]}>
        {item.title ?? 'Untitled'}
      </Text>
      <Text style={[type.body, !item.price && { fontSize: 13 }]}>
        {priceText(item.price)}
        {item.price?.mock ? <Text style={[type.caption, { color: colors.lemonInk }]}> estimate</Text> : null}
      </Text>
      {item.creatorName ? <Text style={type.caption}>{item.creatorName}</Text> : null}
      <Text style={[type.caption, { color: colors.muted2 }]}>Bought {item.stats?.buys ?? 0}</Text>
    </Pressable>
  );
}

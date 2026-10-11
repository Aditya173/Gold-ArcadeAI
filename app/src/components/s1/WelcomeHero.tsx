// S1 welcome art: four tilted glass pills floating over the studio glow, copy depends on the role (design "welcome").
import { View } from 'react-native';
import { Chip } from '../ui';
import type { Role } from '../../services/api';
import { colors } from '../../theme';

// [label, centre x %, top px, tilt deg, dot] from Fan-Made "welcome".
const PILLS: Record<Role, [string, number, number, number, string][]> = {
  creator: [
    ['Connect with your audience', 34, 70, -7, colors.lemon],
    ['Formalize your style', 66, 142, 6, colors.ink],
    ['Earn revenue', 30, 214, 4, colors.rust],
    ['Create with your fans', 64, 284, -5, colors.lemon],
  ],
  fan: [
    ['Decorate your home', 64, 60, 5, colors.ink],
    ['Elevate your wardrobe', 32, 134, -6, colors.lemon],
    ['Style your jewelry', 68, 206, -4, colors.rust],
    ['Host with the most', 36, 276, 7, colors.ink],
  ],
};
const SLOT = 300; // wide enough for any pill; centred on x% so the pill's centre sits there

export function WelcomeHero({ role }: { role: Role }) {
  return (
    <View style={{ height: 320 }} pointerEvents="none">
      {PILLS[role].map(([label, x, top, tilt, dot]) => (
        <View key={label} style={{ position: 'absolute', top, left: `${x}%`, width: SLOT, marginLeft: -SLOT / 2, alignItems: 'center' }}>
          <Chip label={label} dot={dot} tilt={tilt} size="sm" style={{ alignSelf: 'center' }} />
        </View>
      ))}
    </View>
  );
}

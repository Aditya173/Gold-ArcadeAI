// Design tokens from marketplace/Merch Studio v4.dc.html (390x844 iPhone frame).
// Every colour, font, radius, spacing and shadow lives here so screens never hard-code style values.
import { Platform, type TextStyle } from 'react-native';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Outfit_500Medium, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';

// FAN-MADE design pass (docs/design/FAN_MADE.md): wordmark + app-name copy.
export const brand = 'FAN-MADE';

export const colors = {
  // surfaces
  bg: '#e6e1d5', // page / outside the frame
  screenTop: '#f6f4f0', // studio (creator) screen gradient
  screenMid: '#eeeae1',
  screenBottom: '#e9e5d8',
  storeBg: '#fbfaf7', // fan storefront screens (no glow)
  glowWhite: '#ffffff',
  glowLemon: '#fdff7b',
  phone: '#0d0a10',
  white: '#ffffff',

  // frosted glass controls
  glass: 'rgba(255,255,255,.55)',
  glassCard: 'rgba(255,255,255,.5)',
  glassStrong: 'rgba(255,255,255,.75)',
  glassSelected: 'rgba(255,255,255,.8)',
  glassWeak: 'rgba(255,255,255,.35)',
  glassFaint: 'rgba(255,255,255,.3)',
  glassBorder: 'rgba(255,255,255,.9)',
  inputBg: 'rgba(255,255,255,.7)',
  linkBg: 'rgba(255,255,255,.6)',
  glassPill: 'rgba(255,255,255,.7)', // S1 floating pills
  glassBorderStrong: 'rgba(255,255,255,.95)',

  // ink
  ink: '#111111',
  inkSoft: '#3d382f',
  heroInk: '#2a211b',
  muted: '#5f584c',
  muted2: '#6e675a',
  placeholder: '#9a9384',
  mono: '#8a8170',

  // accents
  lemon: '#fdff7b',
  lemonLight: '#feffb0',
  lemonInk: '#4d3d00',
  rust: '#a76549',
  danger: '#c8472d',

  // lines and fills
  hairline: 'rgba(17,17,17,.08)',
  outline: 'rgba(17,17,17,.12)',
  stepOff: 'rgba(17,17,17,.15)',
  radioOff: 'rgba(17,17,17,.25)',
  dashed: 'rgba(17,17,17,.15)',
  dashedStrong: 'rgba(17,17,17,.2)',
  border: '#e5dfd2', // light outline on white (store inputs, chips)
  chipBg: '#f1ede4', // store back button, guardrail chips
  tile: '#efe9dd', // image placeholder
  tileAlt: '#f7f3ec',
  disabledBg: 'rgba(17,17,17,.08)',
  disabledInk: 'rgba(17,17,17,.38)',
  scrim: 'rgba(0,0,0,.28)',

  // FAN-MADE store look
  storeDashedBg: '#f6f3ec', // "Designing your piece…" tile
  storeDashed: '#e0d8c8',
  stripeA: '#ecdfcd', // generated-image placeholder stripes
  stripeB: '#f6efe3',
  monoWarm: '#8a7258',

  // iOS system sheet (photo-permission alert), only if ever drawn in-app
  iosBlue: '#007aff',
  iosSheet: 'rgba(242,242,242,.92)',
  iosSeparator: 'rgba(60,60,67,.36)',
} as const;

// Gradient stops for expo-linear-gradient.
export const gradients = {
  screen: { colors: [colors.screenTop, colors.screenMid, colors.screenBottom], locations: [0, 0.55, 1] },
  primary: { colors: [colors.lemonLight, colors.lemon], locations: [0, 1] },
  dark: { colors: ['#3a3a3a', colors.ink], locations: [0, 1] },
} as const;

// One family name per weight (custom fonts ignore fontWeight on Android).
export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
  round: 'Outfit_700Bold',
  roundMedium: 'Outfit_500Medium',
  serif: 'InstrumentSerif_400Regular',
  grotesk: 'BricolageGrotesque_800ExtraBold',
  groteskBold: 'BricolageGrotesque_700Bold',
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }) as string,
} as const;

// Pass to useFonts(fontAssets) in the root layout.
export const fontAssets = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  Outfit_500Medium,
  Outfit_700Bold,
  InstrumentSerif_400Regular,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
};

// The four shop fonts from "Style Your Shop" (S3/S8 brand preview).
export const shopFonts = [
  { label: 'Clean', fontFamily: fonts.bold },
  { label: 'Round', fontFamily: fonts.round },
  { label: 'Bold', fontFamily: fonts.grotesk },
  { label: 'Serif', fontFamily: fonts.serif },
] as const;

export const radii = {
  xs: 8,
  sm: 10,
  md: 12,
  button: 14,
  lg: 16,
  card: 18,
  xl: 20,
  hero: 24,
  tile: 32,
  pill: 999,
} as const;

export const space = {
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 14,
  l: 16,
  gutter: 20, // screen side padding
  xl2: 24,
  xl3: 28,
  xl4: 36, // footer bottom padding
} as const;

// letterSpacing: CSS em values converted to px at each size.
export const type = {
  display: { fontFamily: fonts.extrabold, fontSize: 44, lineHeight: 48, letterSpacing: -1.54, color: colors.ink },
  headline: { fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -1.02, color: colors.ink },
  title: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.7, color: colors.ink },
  heading: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: colors.ink },
  lead: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: colors.muted },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, color: colors.muted },
  bodyEmphasis: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.ink },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.muted },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  button: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  buttonSm: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  chip: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  badge: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink },
  mono: { fontFamily: fonts.mono, fontSize: 10, color: colors.mono },
  // FAN-MADE
  wordmark: { fontFamily: fonts.extrabold, fontSize: 15, lineHeight: 20, letterSpacing: 3.6, textAlign: 'center', color: colors.ink },
  pill: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }, // S1 floating pills
  vibe: { fontFamily: fonts.semibold, fontSize: 18, color: colors.ink }, // S2 vibes chips
  storeName: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.4, color: colors.ink }, // pass the shop font as fontFamily
} satisfies Record<string, TextStyle>;

// RN >= 0.76 boxShadow strings, copied from the design.
export const shadows = {
  soft: { boxShadow: '0 2px 10px rgba(90,70,30,.05)' },
  glass: { boxShadow: '0 4px 14px rgba(90,70,30,.07)' },
  raised: { boxShadow: '0 8px 22px rgba(90,70,30,.09)' },
  phone: { boxShadow: '0 30px 60px -24px rgba(60,50,20,.35)' },
  primary: { boxShadow: 'inset 0 1px 0 rgba(255,255,255,.8), 0 0 0 1px rgba(17,17,17,.08), 0 4px 12px rgba(110,110,0,.12)' },
  dark: { boxShadow: 'inset 0 1px 0 rgba(255,255,255,.2), 0 1px 2px rgba(17,17,17,.18)' },
  pill: { boxShadow: '0 3px 10px rgba(90,70,30,.08)' }, // S1 floating pills
} as const;

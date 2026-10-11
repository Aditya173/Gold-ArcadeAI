// UI primitives faithful to marketplace/Merch Studio v4.dc.html. Tokens come from ../theme.
import React, { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type RefreshControlProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, gradients, radii, shadows, space, type } from '../theme';

type Style = StyleProp<ViewStyle>;

// ---------- Screen ----------

// Soft blurred blob, drawn as concentric translucent circles (CSS filter blur is not reliable on iOS).
function Glow({ size, color, opacity, style }: { size: number; color: string; opacity: number; style: ViewStyle }) {
  const rings = 8;
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size * 1.6, height: size * 1.6 }, style]}>
      {Array.from({ length: rings }, (_, i) => {
        const d = size * 1.6 * (1 - i / rings);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: (size * 1.6 - d) / 2,
              top: (size * 1.6 - d) / 2,
              width: d,
              height: d,
              borderRadius: d / 2,
              backgroundColor: color,
              opacity: (opacity / rings) * 1.4,
            }}
          />
        );
      })}
    </View>
  );
}

export function Screen({
  children,
  variant = 'studio',
  scroll = true,
  header,
  footer,
  contentStyle,
  refreshControl,
}: {
  children?: ReactNode;
  /** studio = creator/onboarding gradient + glow; store = flat fan storefront. */
  variant?: 'studio' | 'store';
  scroll?: boolean;
  header?: ReactNode;
  /** Sticky bottom area for the main CTA. */
  footer?: ReactNode;
  contentStyle?: Style;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) {
  const insets = useSafeAreaInsets();
  const body = [styles.content, contentStyle];
  return (
    <View style={[styles.fill, { backgroundColor: variant === 'store' ? colors.storeBg : colors.screenMid }]}>
      {variant === 'studio' && (
        <>
          <LinearGradient
            colors={gradients.screen.colors}
            locations={gradients.screen.locations}
            style={StyleSheet.absoluteFill}
          />
          <Glow size={300} color={colors.glowWhite} opacity={0.8} style={{ left: -90 - 90, top: 80 - 90 }} />
          <Glow size={260} color={colors.glowLemon} opacity={0.7} style={{ right: -90 - 78, bottom: 120 - 78 }} />
        </>
      )}
      <KeyboardAvoidingView style={[styles.fill, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {header}
        {scroll ? (
          <ScrollView
            style={styles.fill}
            contentContainerStyle={body}
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.fill, body]}>{children}</View>
        )}
        {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.l) + space.md }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

// ---------- Header + Stepper ----------

export function Stepper({ count = 3, current }: { count?: number; current: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.xs }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ width: 20, height: 4, borderRadius: 2, backgroundColor: i <= current ? colors.ink : colors.stepOff }} />
      ))}
    </View>
  );
}

export function Header({
  onBack,
  title,
  titleStyle,
  right,
  step,
  steps = 3,
  variant = 'studio',
  avatar,
}: {
  onBack?: () => void;
  title?: string;
  /** e.g. the creator's shop font on storefront screens. */
  titleStyle?: StyleProp<TextStyle>;
  right?: ReactNode;
  /** 0-based onboarding step; shows the centred stepper. */
  step?: number;
  steps?: number;
  variant?: 'studio' | 'store';
  /** Store header: 34px creator logo circle left of the name (null = plain tile circle). */
  avatar?: string | null;
}) {
  const store = variant === 'store';
  const size = 36;
  return (
    <View style={[styles.header, { height: store ? 52 : 44, paddingHorizontal: store ? space.gutter : space.l }]}>
      <View style={styles.headerSide}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            style={[
              { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' },
              store ? { backgroundColor: colors.chipBg } : { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
            ]}
          >
            <Text style={{ fontSize: store ? 20 : 22, lineHeight: store ? 22 : 24, color: colors.ink, marginTop: -2 }}>‹</Text>
          </Pressable>
        ) : null}
        {avatar !== undefined ? (
          <View style={styles.avatar}>
            {avatar ? <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          </View>
        ) : null}
        {title ? (
          <Text numberOfLines={1} style={[styles.headerTitle, store && type.storeName, titleStyle]}>
            {title}
          </Text>
        ) : null}
      </View>
      {step !== undefined ? (
        <View style={styles.headerCenter} pointerEvents="none">
          <Stepper count={steps} current={step} />
        </View>
      ) : null}
      <View>{right}</View>
    </View>
  );
}

// ---------- Button ----------

type ButtonVariant = 'primary' | 'dark' | 'secondary' | 'accent' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled,
  loading,
  color,
  textColor,
  style,
}: {
  title: string;
  onPress?: () => void;
  /** primary = lemon CTA; dark = ink; secondary = white outline; accent = creator colour (pass color); ghost = text only. */
  variant?: ButtonVariant;
  size?: 'lg' | 'sm';
  disabled?: boolean;
  loading?: boolean;
  color?: string;
  textColor?: string;
  style?: Style;
}) {
  const off = disabled || loading;
  const lg = size === 'lg';
  const box: ViewStyle = lg
    ? { height: 54, borderRadius: radii.button, paddingHorizontal: space.gutter }
    : { height: 32, borderRadius: radii.sm, paddingHorizontal: space.xl };
  const fg =
    textColor ?? (disabled ? colors.disabledInk : variant === 'dark' || variant === 'accent' ? colors.white : variant === 'ghost' ? colors.muted : colors.ink);
  const grad = disabled ? null : variant === 'primary' ? gradients.primary : variant === 'dark' ? gradients.dark : null;
  const flat: ViewStyle = disabled
    ? { backgroundColor: colors.disabledBg }
    : variant === 'secondary'
      ? { backgroundColor: colors.white, borderWidth: 1, borderColor: lg ? colors.border : colors.outline }
      : variant === 'accent'
        ? { backgroundColor: color ?? colors.ink }
        : variant === 'primary'
          ? shadows.primary
          : variant === 'dark'
            ? shadows.dark
            : {};
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [box, flat, lg && { alignSelf: 'stretch' }, { opacity: pressed ? 0.85 : 1 }, style]}
    >
      {grad ? (
        <LinearGradient colors={grad.colors} locations={grad.locations} style={[StyleSheet.absoluteFill, { borderRadius: box.borderRadius }]} />
      ) : null}
      <View style={styles.buttonInner}>
        {loading ? <ActivityIndicator size="small" color={fg} /> : null}
        <Text numberOfLines={1} style={[lg ? type.button : type.buttonSm, { color: fg }]}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

/** Pill segmented control (S1 "I'm a creator" / "I'm a fan"). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: Style;
}) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.segment, on && { backgroundColor: colors.ink }]}
          >
            <Text numberOfLines={1} style={[type.buttonSm, { color: on ? colors.white : colors.muted }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Card ----------

export function Card({
  children,
  onPress,
  selected,
  padded = true,
  variant = 'glass',
  style,
}: {
  children?: ReactNode;
  onPress?: () => void;
  selected?: boolean;
  padded?: boolean;
  /** glass = frosted list card; solid = white raised card (shop preview). */
  variant?: 'glass' | 'solid';
  style?: Style;
}) {
  const base: ViewStyle =
    variant === 'solid'
      ? { backgroundColor: colors.white, borderRadius: radii.xl, ...shadows.raised }
      : {
          backgroundColor: selected ? colors.glassStrong : colors.glassCard,
          borderRadius: radii.card,
          borderWidth: selected ? 1.5 : 1,
          borderColor: selected ? colors.ink : colors.glassBorder,
          ...shadows.soft,
        };
  const s = [base, { overflow: 'hidden' as const }, padded && { paddingVertical: space.xxl, paddingHorizontal: space.l }, style];
  if (!onPress) return <View style={s}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [s, { opacity: pressed ? 0.9 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

// ---------- Chip ----------

export function Chip({
  label,
  dot,
  note,
  selected,
  onPress,
  tilt,
  variant = 'glass',
  size = 'md',
  style,
}: {
  label: string;
  /** Colour of the leading dot (lemon gets a hairline ring). */
  dot?: string;
  /** Muted trailing text, e.g. a percentage. */
  note?: string;
  selected?: boolean;
  onPress?: () => void;
  /** Degrees of rotation for the floating welcome/vibes chips. */
  tilt?: number;
  /** glass = floating pill; tag = small beige tag; outline = white suggestion pill. */
  variant?: 'glass' | 'tag' | 'outline';
  /** Glass chips only: sm = S1 floating pill (15/600), md = live pill (16/600), lg = S2 vibe chip (18/600). */
  size?: 'sm' | 'md' | 'lg';
  style?: Style;
}) {
  const g = { sm: { py: 9, px: 15, dot: 8, t: type.pill }, md: { py: space.lg, px: space.l, dot: 10, t: type.chip }, lg: { py: space.xl, px: 18, dot: 12, t: type.vibe } }[size];
  const v: ViewStyle =
    variant === 'glass'
      ? size === 'sm'
        ? { paddingVertical: g.py, paddingHorizontal: g.px, backgroundColor: colors.glassPill, borderWidth: 1, borderColor: colors.glassBorderStrong, ...shadows.pill }
        : { paddingVertical: g.py, paddingHorizontal: g.px, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, ...shadows.glass }
      : variant === 'tag'
        ? { paddingVertical: space.sm, paddingHorizontal: space.xl, backgroundColor: colors.chipBg }
        : { height: 34, paddingHorizontal: space.xxl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border };
  const sel: ViewStyle | false = !!selected && { backgroundColor: colors.ink, borderColor: colors.ink };
  const d = variant === 'glass' ? g.dot : 10;
  const t: TextStyle = variant === 'glass' ? g.t : variant === 'tag' ? { ...type.label, color: colors.ink } : { ...type.body, color: colors.ink };
  const content = (
    <>
      {dot ? (
        <View
          style={{
            width: d,
            height: d,
            borderRadius: d / 2,
            backgroundColor: dot,
            borderWidth: dot.toLowerCase() === colors.lemon ? 1 : 0,
            borderColor: 'rgba(17,17,17,.2)',
          }}
        />
      ) : null}
      <Text numberOfLines={1} style={[t, selected && { color: colors.white }]}>
        {label}
      </Text>
      {note ? <Text style={[type.caption, { color: selected ? colors.lemon : colors.muted2 }]}>{note}</Text> : null}
    </>
  );
  const s = [styles.chip, v, sel, tilt ? { transform: [{ rotate: `${tilt}deg` }] } : null, style];
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!selected }} style={s}>
      {content}
    </Pressable>
  ) : (
    <View style={s}>{content}</View>
  );
}

// ---------- Input ----------

export function Input({
  label,
  error,
  hint,
  style,
  ...rest
}: TextInputProps & { label?: string; error?: string | null; hint?: string }) {
  return (
    <View style={{ gap: space.sm }}>
      {label ? <Text style={[type.label, { paddingHorizontal: space.xs }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.placeholder}
        style={[styles.input, error ? { borderColor: colors.danger } : null, style]}
        {...rest}
      />
      {error ? (
        <Text style={[type.caption, { color: colors.danger, paddingHorizontal: space.xs }]}>{error}</Text>
      ) : hint ? (
        <Text style={[type.caption, { paddingHorizontal: space.xs }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

// ---------- Badge ----------

export function Badge({
  label,
  tone = 'neutral',
  style,
}: {
  label: string;
  /** neutral = beige; lemon = highlight (estimate, listed); ink = black/lemon (fan edition, yours); danger = not makeable; outline = generating. */
  tone?: 'neutral' | 'lemon' | 'ink' | 'danger' | 'outline';
  style?: Style;
}) {
  const t = {
    neutral: { bg: colors.chipBg, fg: colors.ink, border: 'transparent' },
    lemon: { bg: colors.lemon, fg: colors.lemonInk, border: 'rgba(17,17,17,.12)' },
    ink: { bg: colors.ink, fg: colors.lemon, border: colors.ink },
    danger: { bg: 'rgba(200,71,45,.12)', fg: colors.danger, border: 'transparent' },
    outline: { bg: colors.glassFaint, fg: colors.muted2, border: colors.dashed },
  }[tone];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: t.bg, borderColor: t.border, borderStyle: tone === 'outline' ? 'dashed' : 'solid' },
        style,
      ]}
    >
      <Text numberOfLines={1} style={[type.badge, { color: t.fg }]}>
        {label}
      </Text>
    </View>
  );
}

/** Row of palette colours (hex), as in the "Color Palette" options. */
export function PaletteStrip({ colors: hexes, height = 32, style }: { colors: string[]; height?: number; style?: Style }) {
  return (
    <View style={[styles.palette, { height }, style]}>
      {hexes.map((c, i) => (
        <View key={`${c}-${i}`} style={{ flex: 1, backgroundColor: c }} />
      ))}
    </View>
  );
}

// ---------- ImageTile ----------

export function ImageTile({
  uri,
  label,
  status,
  aspectRatio = 1,
  radius = radii.lg,
  framed,
  selected,
  variant = 'studio',
  style,
  children,
}: {
  /** store = warm dashed "Designing your piece…" slot on storefront screens. */
  variant?: 'studio' | 'store';
  /** http(s) or data: URI. Missing or failed -> striped placeholder with label; the tile is kept. */
  uri?: string | null;
  /** Mono caption shown on the placeholder. */
  label?: string;
  /** generating -> dashed "Designing…" slot. */
  status?: 'generating' | 'ready';
  aspectRatio?: number;
  radius?: number;
  /** Frosted 6px frame (S4/S6 product grid). */
  framed?: boolean;
  selected?: boolean;
  style?: Style;
  /** Overlay content (e.g. a corner Badge). */
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (status === 'generating') {
    return (
      <View
        style={[
          styles.generating,
          { aspectRatio, borderRadius: radius + 2 },
          variant === 'store' && { backgroundColor: colors.storeDashedBg, borderColor: colors.storeDashed },
          style,
        ]}
      >
        <ActivityIndicator size="small" color={colors.muted2} />
        <Text style={[variant === 'store' ? type.bodyEmphasis : type.label, { color: colors.muted2 }]}>
          {label ?? (variant === 'store' ? 'Designing your piece…' : 'Designing…')}
        </Text>
        {children}
      </View>
    );
  }
  const inner = (
    <View style={[styles.tile, { borderRadius: framed ? radius - 5 : radius }, framed ? styles.fill : { aspectRatio }]}>
      {uri && !failed ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.tilePlaceholder]}>
          <Text numberOfLines={2} style={type.mono}>
            {label ?? 'image'}
          </Text>
        </View>
      )}
      {children}
    </View>
  );
  if (!framed) {
    return <View style={[{ borderRadius: radius, borderWidth: selected ? 2 : 0, borderColor: colors.ink, overflow: 'hidden' }, style]}>{inner}</View>;
  }
  return (
    <View
      style={[
        styles.frame,
        { aspectRatio, borderRadius: radius + 2, borderColor: selected ? colors.ink : colors.glassBorder, borderWidth: selected ? 1.5 : 1 },
        style,
      ]}
    >
      {inner}
    </View>
  );
}

// ---------- Section ----------

export function Section({ title, right, children, style }: { title?: string; right?: ReactNode; children?: ReactNode; style?: Style }) {
  return (
    <View style={[{ gap: space.md }, style]}>
      {title || right ? (
        <View style={styles.sectionHead}>
          {title ? <Text style={type.bodyEmphasis}>{title}</Text> : <View />}
          {typeof right === 'string' ? <Text style={[type.caption, { color: colors.muted2 }]}>{right}</Text> : right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

// ---------- States ----------

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  style,
}: {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: Style;
}) {
  return (
    <View style={[styles.state, style]}>
      <Text style={[type.heading, { textAlign: 'center' }]}>{title}</Text>
      {message ? <Text style={[type.body, { textAlign: 'center' }]}>{message}</Text> : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} variant="secondary" size="sm" style={{ marginTop: space.md }} /> : null}
    </View>
  );
}

/** Always shows the backend's error.message and a retry action (brief 1.0). */
export function ErrorState({
  message,
  onRetry,
  title = 'Something went wrong',
  style,
}: {
  message: string;
  onRetry?: () => void;
  title?: string;
  style?: Style;
}) {
  return (
    <View style={[styles.state, style]} accessibilityRole="alert">
      <View style={styles.errorDot}>
        <Text style={[type.bodyStrong, { color: colors.white }]}>!</Text>
      </View>
      <Text style={[type.heading, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.body, { textAlign: 'center' }]}>{message}</Text>
      {onRetry ? <Button title="Try again" onPress={onRetry} variant="dark" size="sm" style={{ marginTop: space.md }} /> : null}
    </View>
  );
}

export function LoadingState({ label = 'Loading…', style }: { label?: string; style?: Style }) {
  return (
    <View style={[styles.state, style]} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.ink} />
      <Text style={[type.label, { textAlign: 'center' }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: space.gutter, paddingTop: space.l, paddingBottom: space.l, gap: space.lg },
  footer: { paddingHorizontal: space.gutter, paddingTop: space.xl, gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSide: { flexDirection: 'row', alignItems: 'center', gap: space.lg, flexShrink: 1, minWidth: 36 },
  headerCenter: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink, flexShrink: 1 },
  avatar: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', backgroundColor: colors.tile },
  buttonInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md },
  segmented: {
    flexDirection: 'row',
    gap: space.xs,
    padding: space.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    ...shadows.soft,
  },
  segment: { flex: 1, height: 40, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.md, borderRadius: radii.pill },
  input: {
    height: 52,
    borderRadius: radii.button,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.white,
    paddingHorizontal: space.l,
    fontFamily: fonts.medium,
    fontSize: 17,
    color: colors.ink,
    ...shadows.soft,
  },
  badge: { alignSelf: 'flex-start', borderRadius: radii.pill, borderWidth: 1, paddingVertical: 3, paddingHorizontal: space.md },
  palette: { flexDirection: 'row', borderRadius: radii.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.hairline },
  generating: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.glassFaint,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
  },
  tile: { overflow: 'hidden', backgroundColor: colors.tile },
  tilePlaceholder: { justifyContent: 'flex-end', padding: space.md, backgroundColor: colors.tile },
  frame: { padding: space.sm, backgroundColor: colors.glass, ...shadows.glass },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: space.xs },
  state: { alignItems: 'center', justifyContent: 'center', gap: space.md, paddingVertical: space.xl3, paddingHorizontal: space.gutter },
  errorDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
});

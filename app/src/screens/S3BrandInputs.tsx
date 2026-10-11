// S3 Brand inputs (creator), FAN-MADE "Style Your Shop": preview, logo, palette, font (preview only), the 3 style
// images, then name / handle / Instagram imports and style words. Submit hands the request to S4, which makes POST /creators/onboard (brief S3/S4).
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { signInAsDemoCreator } from '../services/firebase';
import { setSession } from '../store/session';
import { API_BASE, api, errorMessage, type ImageKind, type InstagramMedia, type ScrapedImage } from '../services/api';
import { Badge, Button, Card, Chip, ErrorState, Header, ImageTile, Input, LoadingState, PaletteStrip, Screen, Section } from '../components/ui';
import { PickGrid } from '../components/s3/PickGrid';
import { setDraft } from '../components/s3/draft';
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
  MAX_STYLE_REFS,
  PALETTE_MAX,
  base64Bytes,
  isHex,
  isInstagramHandle,
  normalizeHex,
  slug,
  stripAt,
  validPalette,
} from '../lib/validators';
import { colors, radii, shadows, shopFonts, space, type } from '../theme';

const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const LIMITS: Record<ImageKind, number> = { logo: 2, reference: 4, instagram: 4 };
const PRESETS = [
  { name: 'Kitchen table', hexes: ['#f3ead7', '#c8472d', '#edd27a', '#7a7a3a', '#2b2622'] },
  { name: 'Coastal', hexes: ['#f4efe6', '#3b6e8f', '#a8c5d6', '#e3b778'] },
];

// Perceived brightness (0-255) of #rrggbb: ink or white text on the accent "Shop now" pill.
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
};

// Palette preset row (design: glass row, 32px strip, 20px radio).
const row: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: space.xxl,
  paddingVertical: space.xl,
  paddingHorizontal: space.xxl,
  borderRadius: radii.lg,
  ...shadows.soft,
};

interface Img {
  key: string;
  kind: ImageKind;
  mediaType: string;
  dataBase64: string;
  uri: string;
}

type IgState = { s: 'idle' } | { s: 'connecting' } | { s: 'connected'; username: string } | { s: 'error'; message: string };
type ScrapeState = { s: 'idle' } | { s: 'loading' } | { s: 'done'; images: ScrapedImage[] } | { s: 'error'; message: string };

const mimeFromUri = (uri: string) => {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
};

// Default: first logo + first reference + first Instagram image (no Instagram -> next reference).
function defaultRefs(tiles: { key: string; kind: ImageKind }[]) {
  const first = (k: ImageKind, skip: string[] = []) => tiles.find((t) => t.kind === k && !skip.includes(t.key))?.key;
  const picks = [first('logo'), first('reference')].filter(Boolean) as string[];
  const third = first('instagram') ?? first('reference', picks);
  if (third) picks.push(third);
  return picks.slice(0, MAX_STYLE_REFS);
}

export default function S3BrandInputs() {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [instagram, setInstagram] = useState('');
  const [images, setImages] = useState<Img[]>([]);
  const [pickErr, setPickErr] = useState<string | null>(null);
  const [palette, setPalette] = useState<string[]>(['', '']);
  const [words, setWords] = useState('');
  const [refsOverride, setRefsOverride] = useState<string[] | null>(null);
  const [font, setFont] = useState(0); // preview only

  const [ig, setIg] = useState<IgState>({ s: 'idle' });
  const [igMedia, setIgMedia] = useState<InstagramMedia[] | null>(null);
  const [igPicked, setIgPicked] = useState<string[]>([]);

  const [scrapeHandle, setScrapeHandle] = useState('');
  const [scrape, setScrape] = useState<ScrapeState>({ s: 'idle' });

  // ---------- derived ----------
  const pickedMedia = (igMedia ?? []).filter((m) => igPicked.includes(m.id));
  const tiles = [
    ...images.map((i) => ({ key: i.key, kind: i.kind, uri: i.uri, label: i.kind })),
    ...pickedMedia.map((m) => ({ key: `ig:${m.id}`, kind: 'instagram' as ImageKind, uri: m.mediaUrl, label: 'instagram' })),
  ];
  const total = tiles.length;
  const countOf = (k: ImageKind) => tiles.filter((t) => t.kind === k).length;
  const refs = (refsOverride ?? defaultRefs(tiles)).filter((k) => tiles.some((t) => t.key === k));

  const igHandleErr = instagram && !isInstagramHandle(instagram) ? 'Letters, numbers, . and _ only (max 30).' : null;
  const handleErr = handle && !slug(handle) ? 'Use letters or numbers.' : null;
  const hexErrs = palette.map((h) => (h && !isHex(h) ? 'Use #rrggbb' : null));
  const words3 = words.split(',').map((w) => w.trim()).filter(Boolean);
  const cleanPalette = palette.filter(Boolean);

  const problems = [
    !name.trim() && 'shop name',
    (!handle.trim() || handleErr) && 'handle',
    (!instagram.trim() || igHandleErr) && 'Instagram handle',
    total < 1 && 'at least 1 image',
    total > MAX_IMAGES && `at most ${MAX_IMAGES} images`,
    !validPalette(cleanPalette) && '2–6 valid colours',
    words3.length > 3 && 'at most 3 style words',
  ].filter(Boolean) as string[];

  // ---------- Instagram (Meta login) ----------
  async function loadMedia() {
    try {
      const { media } = await api.instagramMedia();
      setIgMedia(media.filter((m) => m.mediaType === 'IMAGE'));
    } catch (e) {
      setIg({ s: 'error', message: errorMessage(e) });
    }
  }

  async function refreshStatus(quiet: boolean) {
    try {
      const st = await api.instagramStatus();
      if (st.connected) {
        const username = st.username ?? '';
        setIg({ s: 'connected', username });
        if (username) setInstagram(`@${username}`);
        await loadMedia();
      } else if (!quiet) setIg({ s: 'error', message: 'Instagram was not connected. You can upload saved posts instead.' });
    } catch (e) {
      if (!quiet) setIg({ s: 'error', message: errorMessage(e) });
    }
  }

  useEffect(() => {
    refreshStatus(true);
  }, []);

  async function connect() {
    setIg({ s: 'connecting' });
    try {
      const { authUrl } = await api.instagramConnect();
      if (/^https?:/.test(authUrl)) {
        await WebBrowser.openAuthSessionAsync(authUrl, Linking.createURL('brand'));
      } else {
        // offline fake (INSTAGRAM_FAKE=1): the backend hands back its own callback path; hit it directly.
        await fetch(`${API_BASE}${authUrl}`);
      }
      await refreshStatus(false);
    } catch (e) {
      setIg({ s: 'error', message: errorMessage(e) });
    }
  }

  function toggleIgMedia(key: string) {
    const id = key.replace(/^ig:/, '');
    if (igPicked.includes(id)) return setIgPicked(igPicked.filter((x) => x !== id));
    if (igPicked.length >= 4) return setPickErr('Pick up to 4 Instagram posts.');
    if (total >= MAX_IMAGES) return setPickErr(`At most ${MAX_IMAGES} images in total.`);
    setPickErr(null);
    setIgPicked([...igPicked, id]);
  }

  // ---------- public-handle import ----------
  async function runScrape() {
    if (!isInstagramHandle(scrapeHandle)) return setScrape({ s: 'error', message: 'Enter a valid Instagram handle.' });
    setScrape({ s: 'loading' });
    try {
      const r = await api.instagramScrape(stripAt(scrapeHandle));
      setScrape({ s: 'done', images: r.images });
      if (!instagram && ig.s !== 'connected') setInstagram(`@${stripAt(scrapeHandle)}`);
    } catch (e) {
      setScrape({ s: 'error', message: errorMessage(e) });
    }
  }

  function toggleScraped(s: ScrapedImage) {
    const key = `scr:${s.mediaId}`;
    if (images.some((i) => i.key === key)) return removeImage(key);
    addImages([{ key, kind: 'instagram', mediaType: s.mediaType, dataBase64: s.dataBase64, uri: `data:${s.mediaType};base64,${s.dataBase64}` }]);
  }

  // ---------- uploads ----------
  function addImages(add: Img[]) {
    const errs: string[] = [];
    const next = [...images];
    for (const im of add) {
      if (!TYPES.includes(im.mediaType)) errs.push('Only PNG, JPEG, WEBP or GIF.');
      else if (base64Bytes(im.dataBase64) > MAX_IMAGE_BYTES) errs.push('Each image must be 1 MB or less.');
      else if (next.filter((i) => i.kind === im.kind).length + (im.kind === 'instagram' ? igPicked.length : 0) >= LIMITS[im.kind])
        errs.push(`At most ${LIMITS[im.kind]} ${im.kind} images.`);
      else if (next.length + igPicked.length >= MAX_IMAGES) errs.push(`At most ${MAX_IMAGES} images in total.`);
      else next.push(im);
    }
    setImages(next);
    setPickErr(errs[0] ?? null);
  }

  async function pick(kind: ImageKind) {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: LIMITS[kind],
    });
    if (res.canceled) return;
    addImages(
      res.assets
        .filter((a) => a.base64)
        .map((a, i) => ({
          key: `${kind}:${Date.now()}:${i}`,
          kind,
          mediaType: a.mimeType && TYPES.includes(a.mimeType) ? a.mimeType : a.mimeType?.includes('heic') ? 'image/jpeg' : a.mimeType ?? mimeFromUri(a.uri),
          dataBase64: a.base64 as string,
          uri: a.uri,
        })),
    );
  }

  function removeImage(key: string) {
    if (key.startsWith('ig:')) return toggleIgMedia(key);
    setImages(images.filter((i) => i.key !== key));
  }

  function toggleRef(key: string) {
    if (refs.includes(key)) return setRefsOverride(refs.filter((k) => k !== key));
    if (refs.length >= MAX_STYLE_REFS) return setPickErr('Pick at most 3 style images.');
    setRefsOverride([...refs, key]);
  }

  // ---------- submit ----------
  function submit() {
    const styleRefs = refs.map((k) => tiles.findIndex((t) => t.key === k)).filter((i) => i >= 0);
    setDraft({
      shopName: name.trim(),
      rows: tiles.map((t) => ({ kind: t.kind, uri: t.uri })),
      req: {
        name: name.trim(),
        handle: slug(handle),
        instagram: instagram.trim(),
        palette: cleanPalette.map(normalizeHex),
        styleWords: words3.length ? words3 : undefined,
        images: images.map(({ kind, mediaType, dataBase64 }) => ({ kind, mediaType, dataBase64 })),
        instagramMediaIds: igPicked.length ? pickedMedia.map((m) => m.id) : undefined,
        styleRefs: styleRefs.length ? styleRefs : undefined,
      },
    });
    router.push('/style');
  }

  async function useDemo() {
    try {
      const u = await signInAsDemoCreator();
      setSession({ uid: u.uid, role: 'creator' });
    } catch (e) {
      return setPickErr(errorMessage(e));
    }
    setDraft({ shopName: 'Wishbone Kitchen', rows: [], req: { fixture: 'brand_wishbonekitchen' } });
    router.push('/style');
  }

  const validHexes = cleanPalette.filter(isHex).map(normalizeHex);
  const logo = tiles.find((t) => t.kind === 'logo');
  // Preview cover = first picked style image (design), else the first reference / Instagram image.
  const cover = tiles.find((t) => t.key === refs[0]) ?? tiles.find((t) => t.kind === 'reference') ?? tiles.find((t) => t.kind === 'instagram');
  const shopFont = { fontFamily: shopFonts[font].fontFamily };
  const accent = validHexes[1] ?? validHexes[0] ?? colors.ink;
  const accentInk = luminance(accent) > 150 ? colors.ink : colors.white;

  return (
    <Screen
      header={<Header onBack={router.canGoBack() ? router.back : undefined} step={1} />}
      contentStyle={{ gap: space.gutter }}
      footer={
        <>
          {problems.length ? <Text style={[type.caption, { textAlign: 'center' }]}>Still needed: {problems.join(', ')}</Text> : null}
          <Button title="Next" disabled={problems.length > 0} onPress={submit} />
          <Button title="Use demo brand (Wishbone Kitchen)" variant="ghost" size="sm" onPress={useDemo} />
        </>
      }
    >
      <Text style={type.title}>Style Your Shop</Text>

      {/* live shop preview */}
      <Card variant="solid" padded={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingVertical: space.xl, paddingHorizontal: space.xxl }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.tile }}>
            {logo ? <ImageTile uri={logo.uri} radius={14} /> : null}
          </View>
          <Text numberOfLines={1} style={[type.bodyStrong, shopFont, { flex: 1 }]}>
            {name.trim() || 'Your shop'}
          </Text>
          {instagram && !igHandleErr ? <Text style={type.caption}>{instagram.startsWith('@') ? instagram : `@${instagram}`}</Text> : null}
        </View>
        <View style={{ marginHorizontal: space.lg, marginBottom: space.lg }}>
          <ImageTile uri={cover?.uri} label="" radius={radii.button} aspectRatio={2.2}>
            {cover ? <LinearGradient colors={['transparent', colors.scrim]} locations={[0.3, 1]} style={StyleSheet.absoluteFill} /> : null}
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.xl, gap: space.md }}>
              <Text numberOfLines={2} style={[shopFont, { fontSize: 22, lineHeight: 26, color: cover ? colors.white : colors.heroInk }]}>
                {words3.length ? words3.join(' · ') : 'Made in your style'}
              </Text>
              <View style={{ alignSelf: 'flex-start', backgroundColor: accent, borderRadius: radii.sm, paddingVertical: space.sm, paddingHorizontal: space.xl }}>
                <Text style={[type.badge, { fontSize: 13, color: accentInk }]}>Shop now</Text>
              </View>
            </View>
          </ImageTile>
        </View>
      </Card>

      <Section title="Logo" right={`${countOf('logo')} of 2`}>
        <Card padded={false} style={{ paddingVertical: space.xl, paddingHorizontal: space.xxl, borderRadius: radii.lg, backgroundColor: colors.glass, flexDirection: 'row', alignItems: 'center', gap: space.xl }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.tile }}>
            {logo ? <ImageTile uri={logo.uri} radius={22} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.bodyEmphasis}>{logo ? 'Your logo' : 'Add your logo'}</Text>
            <Text style={type.caption}>Profile photo</Text>
          </View>
          <Button title="Upload" variant="secondary" size="sm" onPress={() => pick('logo')} disabled={countOf('logo') >= 2} />
        </Card>
      </Section>

      <Section title="Color Palette" right={`${cleanPalette.length} of ${PALETTE_MAX}`}>
        {PRESETS.map((p) => {
          const on = p.hexes.join() === palette.join();
          return (
            <Pressable
              key={p.name}
              onPress={() => setPalette(p.hexes)}
              accessibilityRole="radio"
              accessibilityLabel={`${p.name} palette`}
              accessibilityState={{ selected: on }}
              style={[
                row,
                { backgroundColor: on ? colors.glassSelected : colors.glassCard, borderWidth: on ? 1.5 : 1, borderColor: on ? colors.ink : colors.glassBorder },
              ]}
            >
              <PaletteStrip colors={p.hexes} height={32} style={{ flex: 1 }} />
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white, borderWidth: on ? 6 : 1.5, borderColor: on ? colors.ink : colors.radioOff }} />
            </Pressable>
          );
        })}
        {palette.map((h, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
            <View style={{ width: 44, height: 44, marginTop: space.xs, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.hairline, backgroundColor: isHex(h) ? h : colors.tile }} />
            <View style={{ flex: 1 }}>
              <Input
                placeholder="#rrggbb"
                autoCapitalize="none"
                autoCorrect={false}
                value={h}
                onChangeText={(v) => setPalette(palette.map((x, j) => (j === i ? v : x)))}
                error={hexErrs[i]}
              />
            </View>
            <Pressable
              onPress={() => setPalette(palette.filter((_, j) => j !== i))}
              accessibilityRole="button"
              accessibilityLabel="Remove colour"
              hitSlop={8}
              style={{ paddingTop: space.xxl, paddingHorizontal: space.sm }}
            >
              <Text style={type.bodyStrong}>×</Text>
            </Pressable>
          </View>
        ))}
        {palette.length < PALETTE_MAX ? (
          <Pressable
            onPress={() => setPalette([...palette, ''])}
            accessibilityRole="button"
            accessibilityLabel="Add a custom colour"
            style={{ height: 52, borderRadius: radii.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.dashedStrong, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={[type.bodyEmphasis, { color: colors.muted }]}>+ Custom</Text>
          </Pressable>
        ) : null}
      </Section>

      {/* Font only drives this preview; it is not sent with the shop (docs/design/FAN_MADE.md "Not applied"). */}
      <Section title="Font">
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {shopFonts.map((f, i) => (
            <Pressable
              key={f.label}
              onPress={() => setFont(i)}
              accessibilityRole="radio"
              accessibilityLabel={`${f.label} font`}
              accessibilityState={{ selected: font === i }}
              style={{
                flex: 1,
                height: 76,
                borderRadius: radii.button,
                backgroundColor: colors.glass,
                alignItems: 'center',
                justifyContent: 'center',
                gap: space.xxs,
                borderWidth: font === i ? 1.5 : 1,
                borderColor: font === i ? colors.ink : colors.glassBorder,
              }}
            >
              <Text style={{ fontFamily: f.fontFamily, fontSize: 24, color: colors.ink }}>Aa</Text>
              <Text style={type.caption}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
      </Section>

      <Section title="Reference Images" right={`${refs.length} of 3`}>
        {pickErr ? <Text style={[type.caption, { color: colors.danger }]}>{pickErr}</Text> : null}
        {tiles.length ? (
          <PickGrid tiles={tiles} selected={refs} max={MAX_STYLE_REFS} onToggle={toggleRef} onRemove={removeImage} />
        ) : (
          <Text style={type.caption}>No images yet. Upload a logo, references or Instagram posts.</Text>
        )}
        <Text style={type.caption}>
          Tap the 3 that define your style. {total} of {MAX_IMAGES} images · PNG, JPEG, WEBP or GIF · max 1 MB each.
        </Text>
        <Button
          title={`Upload references (${countOf('reference')} of 4)`}
          variant="secondary"
          size="sm"
          onPress={() => pick('reference')}
          disabled={countOf('reference') >= 4}
          style={{ alignSelf: 'flex-start' }}
        />
      </Section>

      <Section title="Your shop">
        <Input label="Shop name" placeholder="e.g. Wishbone Kitchen" value={name} onChangeText={setName} />
        <Input
          label="Handle"
          placeholder="wishbonekitchen"
          autoCapitalize="none"
          autoCorrect={false}
          value={handle}
          onChangeText={setHandle}
          error={handleErr}
          hint={handle && slug(handle) ? `Your shop id: creator-${slug(handle).toLowerCase()}` : undefined}
        />
        <Input
          label="Instagram handle"
          placeholder="@wishbonekitchen"
          autoCapitalize="none"
          autoCorrect={false}
          value={instagram}
          onChangeText={setInstagram}
          editable={ig.s !== 'connected'}
          error={igHandleErr}
          hint={ig.s === 'connected' ? 'From your connected account' : undefined}
        />
      </Section>

      <Section title="Instagram" right={`${countOf('instagram')} of 4`}>
        <Card padded={false} style={{ padding: space.xl, gap: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
            <View style={{ flex: 1 }}>
              <Text style={type.bodyEmphasis}>Connect Instagram</Text>
              <Text style={type.caption}>
                {ig.s === 'connected' ? `Connected as @${ig.username}` : 'Business or creator account. Pick 1–4 recent posts.'}
              </Text>
            </View>
            {ig.s === 'connected' ? (
              <Badge label="connected" tone="lemon" />
            ) : (
              <Button title={ig.s === 'connecting' ? 'Connecting' : 'Connect'} variant="dark" size="sm" loading={ig.s === 'connecting'} onPress={connect} />
            )}
          </View>
          {ig.s === 'error' ? <Text style={[type.caption, { color: colors.danger }]}>{ig.message} Try the public-handle import or upload saved posts.</Text> : null}
          {ig.s === 'connected' && igMedia === null ? <LoadingState label="Loading your recent posts…" /> : null}
          {ig.s === 'connected' && igMedia && igMedia.length === 0 ? <Text style={type.caption}>No image posts found on this account.</Text> : null}
          {igMedia && igMedia.length ? (
            <PickGrid
              tiles={igMedia.map((m) => ({ key: `ig:${m.id}`, uri: m.mediaUrl, label: m.timestamp?.slice(0, 10) ?? 'post' }))}
              selected={igPicked.map((id) => `ig:${id}`)}
              onToggle={toggleIgMedia}
            />
          ) : null}
        </Card>

        <Card padded={false} style={{ padding: space.xl, gap: space.lg }}>
          <Text style={type.bodyEmphasis}>Import from a public handle</Text>
          <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Input placeholder="@handle" autoCapitalize="none" autoCorrect={false} value={scrapeHandle} onChangeText={setScrapeHandle} />
            </View>
            <Button title="Import" variant="dark" size="sm" loading={scrape.s === 'loading'} onPress={runScrape} style={{ marginTop: space.sm }} />
          </View>
          {scrape.s === 'loading' ? <LoadingState label="Importing latest posts (10–20 s)…" /> : null}
          {scrape.s === 'error' ? (
            <ErrorState title="Import failed" message={`${scrape.message} Connect Instagram or upload saved posts instead.`} onRetry={runScrape} />
          ) : null}
          {scrape.s === 'done' && !scrape.images.length ? <Text style={type.caption}>No images found on that account.</Text> : null}
          {scrape.s === 'done' && scrape.images.length ? (
            <PickGrid
              tiles={scrape.images.map((s) => ({ key: s.mediaId, uri: `data:${s.mediaType};base64,${s.dataBase64}`, label: s.caption?.slice(0, 24) ?? 'post' }))}
              selected={images.filter((i) => i.key.startsWith('scr:')).map((i) => i.key.slice(4))}
              onToggle={(id) => {
                const s = scrape.images.find((x) => x.mediaId === id);
                if (s) toggleScraped(s);
              }}
            />
          ) : null}
        </Card>

        <Button title="Add images from your Instagram (saved posts)" variant="secondary" size="sm" onPress={() => pick('instagram')} disabled={countOf('instagram') >= 4} style={{ alignSelf: 'flex-start' }} />
      </Section>

      <Section title="Style words" right="optional · up to 3">
        <Input placeholder="hand-drawn, coastal" value={words} onChangeText={setWords} error={words3.length > 3 ? 'At most 3 words.' : null} />
        {words3.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {words3.map((w) => (
              <Chip key={w} label={w} variant="tag" />
            ))}
          </View>
        ) : null}
      </Section>
    </Screen>
  );
}

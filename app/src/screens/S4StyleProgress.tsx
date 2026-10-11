// S4 Style creation progress (creator): runs POST /creators/onboard with the request S3 built, showing every image
// row as a dashed "Designing…" tile during the call, then each row's own status; success = FAN-MADE "You're live!"
// (brief S4, docs/design/FAN_MADE.md).
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { ApiError, api, errorMessage, type OnboardResponse } from '../services/api';
import { setSession } from '../store/session';
import { getDraft } from '../components/s3/draft';
import { Button, Chip, EmptyState, ErrorState, Header, ImageTile, LoadingState, PaletteStrip, Screen, Section } from '../components/ui';
import { colors, radii, shadows, space, type } from '../theme';

type State = { s: 'loading' } | { s: 'error'; err: unknown } | { s: 'done'; res: OnboardResponse };

const paletteHexes = (p: OnboardResponse['style']['palette']) => p.map((c) => (typeof c === 'string' ? c : c.hex));

export default function S4StyleProgress() {
  const draft = getDraft();
  const [st, setSt] = useState<State>({ s: 'loading' });

  const run = useCallback(async () => {
    if (!draft) return;
    setSt({ s: 'loading' });
    try {
      const res = await api.onboard(draft.req);
      setSession({ creatorId: res.creatorId, role: 'creator' });
      setSt({ s: 'done', res });
    } catch (err) {
      setSt({ s: 'error', err });
    }
  }, [draft]);

  useEffect(() => {
    run();
  }, [run]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/brand'));
  const header = <Header onBack={back} step={2} />;

  if (!draft) {
    return (
      <Screen header={header}>
        <EmptyState title="Nothing to register yet" message="Add your brand inputs first." actionLabel="Go to brand inputs" onAction={() => router.replace('/brand')} />
      </Screen>
    );
  }

  if (st.s === 'error') {
    const e = st.err;
    const editable = e instanceof ApiError && (e.status === 400 || e.status === 403);
    return (
      <Screen header={header}>
        <ErrorState
          title={e instanceof ApiError && e.status === 403 ? 'That handle is taken' : "Couldn't build your style"}
          message={errorMessage(e)}
          onRetry={run}
        />
        {editable ? <Button title="Edit brand inputs" variant="secondary" size="sm" onPress={back} style={{ alignSelf: 'center' }} /> : null}
      </Screen>
    );
  }

  const res = st.s === 'done' ? st.res : null;
  const rows = res
    ? res.style.images.map((im, i) => ({ kind: im.kind, status: im.status, ref: im.referenceId, uri: draft.rows[i]?.uri }))
    : draft.rows.map((r) => ({ kind: r.kind, status: 'uploading', ref: undefined as string | undefined, uri: r.uri }));
  const failed = rows.filter((r) => r.status === 'failed');
  const registered = rows.length - failed.length;
  const refIdx = (ref?: string) => (ref && res ? res.style.styleRefs.indexOf(ref) + 1 : 0);
  const hexes = res ? paletteHexes(res.style.palette) : [];
  const live = !!res && registered > 0;
  const shop = draft.shopName || res?.creatorId || 'Your shop';
  // ponytail: "{handle}.shop" is display copy only (no store domain exists; docs/design/FAN_MADE.md "Not applied").
  const handle = 'handle' in draft.req ? draft.req.handle : (res?.creatorId.replace(/^creator-/, '') ?? '');
  const toSuggestions = () => router.push({ pathname: '/suggestions', params: { creatorId: res!.creatorId } });
  const asFan = () => router.push({ pathname: '/marketplace', params: { creatorId: res!.creatorId, creatorName: draft.shopName } });

  return (
    <Screen
      header={header}
      footer={
        live ? (
          <>
            <Button title="Add your products" onPress={toSuggestions} />
            <Button title="See it as a fan" variant="dark" onPress={asFan} />
          </>
        ) : (
          <Button title={res ? 'Continue' : 'Designing…'} disabled={!res || registered < 1} onPress={toSuggestions} />
        )
      }
    >
      {live ? (
        <View>
          <View style={{ height: 230 }}>
            <Chip label={`${registered} style images`} dot={colors.lemon} tilt={-7} style={{ position: 'absolute', left: space.lg, top: space.xl3 }} />
            <Chip label={`${hexes.length} colours`} dot={colors.ink} tilt={6} style={{ position: 'absolute', right: space.sm, top: 90 }} />
            <Chip label="fans can design too" dot={colors.rust} tilt={3} style={{ position: 'absolute', left: 40, top: 165 }} />
          </View>
          <Text style={type.display}>You’re live!</Text>
          <Text style={[type.lead, { marginTop: space.lg, marginBottom: space.gutter }]}>{shop} is open. Share the link and watch the orders roll in.</Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: colors.linkBg,
              borderWidth: 1,
              borderColor: colors.white,
              borderRadius: radii.button,
              paddingVertical: space.xxl,
              paddingHorizontal: space.l,
              ...shadows.soft,
            }}
          >
            <Text selectable numberOfLines={1} style={[type.bodyStrong, { flex: 1 }]}>
              {handle}.shop
            </Text>
            <Text style={[type.buttonSm, { color: colors.muted }]}>Hold to copy</Text>
          </View>
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <Text style={type.label}>{res ? 'All done' : 'Designing in your style…'}</Text>
          <Text style={type.title}>{res ? 'Your style' : `Registering ${rows.length} image${rows.length === 1 ? '' : 's'}`}</Text>
        </View>
      )}

      {!res && !rows.length ? <LoadingState label="Registering your images with Arcade" /> : null}

      {res && failed.length ? (
        <Text style={[type.caption, { color: colors.danger }]}>
          {failed.length} image{failed.length > 1 ? 's' : ''} couldn't be registered ({failed.map((f) => f.kind).join(', ')}). You can continue with the
          {` ${registered}`} that worked.
        </Text>
      ) : null}

      {rows.length ? (
        <Section title={live ? 'Your style' : undefined} right={res ? `${res.style.styleRefs.length} of 3 steer every product` : undefined}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xxl }}>
            {rows.map((r, i) => {
              const n = refIdx(r.ref);
              const label = r.status === 'failed' ? 'failed' : r.status === 'uploading' ? 'uploading' : n > 0 ? `style image ${n}` : 'registered';
              return (
                <View key={i} style={{ width: '47.9%', gap: space.xxs }}>
                  {r.status === 'uploading' ? (
                    <ImageTile status="generating" radius={radii.lg} />
                  ) : (
                    <ImageTile uri={r.uri} label={r.kind} framed radius={radii.card} selected={n > 0}>
                      {n > 0 ? (
                        <View style={{ position: 'absolute', top: space.sm, right: space.sm, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={[type.badge, { color: colors.lemon }]}>{n}</Text>
                        </View>
                      ) : null}
                    </ImageTile>
                  )}
                  <Text style={[type.bodyEmphasis, { marginTop: space.xs, textTransform: 'capitalize' }]}>{r.kind}</Text>
                  <Text style={[type.caption, r.status === 'failed' && { color: colors.danger }]}>{label}</Text>
                </View>
              );
            })}
          </View>
        </Section>
      ) : null}

      {res && hexes.length ? (
        <Section title="Palette">
          <PaletteStrip colors={hexes} />
          <Text style={type.caption}>{hexes.join('  ')}</Text>
        </Section>
      ) : null}
      {res && res.style.styleWords.length ? (
        <Section title="Style words">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {res.style.styleWords.map((w) => (
              <Chip key={w} label={w} variant="tag" />
            ))}
          </View>
        </Section>
      ) : null}

      <Text style={type.caption}>Style = your reference images + palette. Arcade uses up to 3 images per product.</Text>
    </Screen>
  );
}

// S6 Made for you: POST /suggest on arrival, poll GET /suggestions every 3 s while it runs. Owner-only screen.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, api, errorMessage, type Creator, type Item, type Reading } from '../services/api';
import { useSession } from '../store/session';
import { usePoll } from '../hooks/usePoll';
import { Button, Chip, EmptyState, ErrorState, Header, LoadingState, Screen, Section } from '../components/ui';
import { CameraRollStrip, StyleUsed, SuggestionCard } from '../components/s6/parts';
import { accentOf } from '../components/s5/parts';
import { space, type } from '../theme';

const COUNT = 4; // runner, plate, print, pendant; same count for POST /suggest and GET /suggestions.

type Run = { state: 'running' } | { state: 'done'; items: Item[] } | { state: 'failed'; status: number; message: string };

export default function S6Suggestions() {
  const router = useRouter();
  const session = useSession();
  const params = useLocalSearchParams<{ creatorId?: string }>();
  const creatorId = (typeof params.creatorId === 'string' && params.creatorId) || session.creatorId;

  const [creator, setCreator] = useState<Creator | null>(null);
  const [creatorErr, setCreatorErr] = useState<ApiError | Error | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [run, setRun] = useState<Run>({ state: 'running' });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => void (mounted.current = false);
  }, []);

  const loadCreator = useCallback(() => {
    if (!creatorId) return;
    setCreatorErr(null);
    api.creator(creatorId).then(
      (c) => mounted.current && setCreator(c),
      (e) => mounted.current && setCreatorErr(e),
    );
  }, [creatorId]);

  const start = useCallback(() => {
    if (!creatorId) return;
    setRun({ state: 'running' });
    api.suggest(creatorId, COUNT).then(
      (r) => mounted.current && setRun({ state: 'done', items: r.items }),
      (e) =>
        mounted.current &&
        setRun({ state: 'failed', status: e instanceof ApiError ? e.status : 0, message: errorMessage(e) }),
    );
  }, [creatorId]);

  useEffect(() => {
    loadCreator();
    start();
  }, [loadCreator, start]);

  useEffect(() => {
    if (!session.uid) return;
    api.getInsights(session.uid).then(
      (i) => mounted.current && setReading(i.reading),
      () => {}, // strip is optional; /suggest reports a missing reading as 409.
    );
  }, [session.uid]);

  const running = run.state === 'running' && !!creatorId;
  const poll = usePoll(() => api.suggestions(creatorId!, COUNT), 3000, running);

  const back = router.canGoBack() ? () => router.back() : undefined;
  // Fan = storefront "Design your own" look; creator = studio "Designing…" look.
  const fan = session.role !== 'creator';
  const look = fan ? 'store' : 'studio';
  const header = <Header variant={look} onBack={back} title={fan ? undefined : 'Made for you'} />;
  const pickAgain = () => router.replace(session.role === 'creator' ? '/brand' : '/creators');

  if (!creatorId) {
    return (
      <Screen variant={look} header={header}>
        <EmptyState title="Pick a creator first" message="Choose whose style to make your products in." actionLabel="Choose a creator" onAction={pickAgain} />
      </Screen>
    );
  }

  if ((run.state === 'failed' && run.status === 404) || (creatorErr instanceof ApiError && creatorErr.status === 404)) {
    return (
      <Screen variant={look} header={header}>
        <EmptyState title="No such creator" message={run.state === 'failed' ? run.message : creatorErr?.message} actionLabel="Back" onAction={pickAgain} />
      </Screen>
    );
  }
  if (run.state === 'failed' && run.status === 409) {
    return (
      <Screen variant={look} header={header}>
        <EmptyState title="Attach an insight pack first" message={run.message} actionLabel="Go to onboarding" onAction={() => router.replace('/onboarding')} />
      </Screen>
    );
  }

  // Never treat an early [] as empty: while running, pad with generating placeholders up to COUNT.
  const items: Item[] = run.state === 'done' ? run.items : poll.data?.items ?? [];
  const slots: (Item | null)[] = running ? [...items, ...Array(Math.max(0, COUNT - items.length)).fill(null)] : items;
  const failedCount = items.filter((i) => i.status === 'not_makeable').length;
  const name = creator?.name ?? 'the creator';

  return (
    <Screen
      variant={look}
      header={header}
      footer={
        running ? (
          <Button title="Designing…" disabled loading />
        ) : fan ? (
          <Button title="Go to marketplace" variant="accent" color={accentOf(creator?.palette)} onPress={() => router.push('/marketplace')} />
        ) : (
          <Button title="Go to marketplace" onPress={() => router.push('/marketplace')} />
        )
      }
    >
      {fan ? (
        <View style={{ gap: space.xxl }}>
          <Text style={type.title}>What should {name} make you?</Text>
          {creator?.styleWords?.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {creator.styleWords.map((w) => (
                <Chip key={w} label={w} variant="tag" />
              ))}
            </View>
          ) : null}
          <Text style={type.body}>Made from your camera roll in {name}'s style.</Text>
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <Text style={type.label}>{running ? 'Designing in your style…' : 'All done'}</Text>
          <Text style={type.title}>{running ? `Making ${slots.length} pieces` : 'Your first collection'}</Text>
        </View>
      )}
      {creatorErr && !(creatorErr instanceof ApiError && creatorErr.status === 404) ? (
        <ErrorState title="Couldn't load the creator" message={creatorErr.message} onRetry={loadCreator} />
      ) : null}
      {reading?.signature?.length ? <CameraRollStrip reading={reading} /> : null}

      <Section
        title={running ? 'Designing your products' : 'Your products'}
        right={running ? 'listed automatically in the marketplace' : failedCount ? `${failedCount} couldn't be made` : 'listed in the marketplace'}
      >
        {run.state === 'failed' ? (
          <ErrorState message={run.message} onRetry={start} />
        ) : slots.length === 0 ? (
          <EmptyState title="Nothing made yet" message="Try again to make your products." actionLabel="Make products" onAction={start} />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: fan ? space.l : space.xxl, columnGap: fan ? space.xl : space.xxl }}>
            {slots.map((it, i) => (
              <SuggestionCard key={it?.itemId ?? `slot-${i}`} item={it} creatorName={name} store={fan} onOpen={(id) => router.push(`/product/${id}`)} />
            ))}
          </View>
        )}
        {!running && failedCount ? <Button title="Retry the ones that failed" variant="secondary" size="sm" onPress={start} /> : null}
      </Section>

      {creator ? <StyleUsed creator={creator} words={!fan} /> : !creatorErr ? <LoadingState label="Loading style…" /> : null}
    </Screen>
  );
}

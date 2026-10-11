// S5 Creator search (fan): GET /creators?q= -> pick a creator -> S6. Wishbone Kitchen is first before typing.
import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { api, errorMessage, type CreatorSummary } from '../services/api';
import { setSession, useSession } from '../store/session';
import { Button, EmptyState, ErrorState, Header, Input, LoadingState, Screen, Section } from '../components/ui';
import { CreatorCard, CreatorPreview, accentOf } from '../components/s5/parts';
import { space, type } from '../theme';

export default function S5CreatorSearch() {
  const router = useRouter();
  const session = useSession();
  const [q, setQ] = useState('');
  const [creators, setCreators] = useState<CreatorSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(session.creatorId);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    const t = setTimeout(
      () =>
        api
          .creators(q.trim() || undefined)
          .then((r) => live && setCreators(r.creators))
          .catch((e) => live && setError(errorMessage(e))),
      q ? 250 : 0,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, nonce]);

  // Top match is selected by default, so Wishbone Kitchen is ready to go before typing.
  const selected = creators?.find((c) => c.creatorId === selectedId) ?? creators?.[0] ?? null;

  const choose = () => {
    if (!selected) return;
    setSession({ creatorId: selected.creatorId });
    router.push('/suggestions');
  };

  return (
    <Screen
      variant="store"
      header={<Header variant="store" onBack={router.canGoBack() ? () => router.back() : undefined} title="Creators" />}
      footer={
        selected ? (
          <Button title={`Design with ${selected.name}`} variant="accent" color={accentOf(selected.palette)} onPress={choose} />
        ) : null
      }
    >
      <Text style={type.title}>Whose style?</Text>
      <Text style={type.lead}>Pick a creator. We'll make products from your camera roll in their style.</Text>
      <Input
        value={q}
        onChangeText={setQ}
        placeholder="Search creators"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search creators"
      />
      {error ? (
        <ErrorState message={error} onRetry={() => setNonce((n) => n + 1)} />
      ) : !creators ? (
        <LoadingState label="Finding creators…" />
      ) : creators.length === 0 ? (
        <EmptyState title="No creators found" message={q ? `Nothing matches "${q}".` : undefined} />
      ) : (
        <Section style={{ gap: space.lg }}>
          {creators.map((c) => (
            <CreatorCard key={c.creatorId} c={c} selected={c.creatorId === selected?.creatorId} onPress={() => setSelectedId(c.creatorId)} />
          ))}
        </Section>
      )}
      {selected && !error ? <CreatorPreview creator={selected} /> : null}
    </Screen>
  );
}

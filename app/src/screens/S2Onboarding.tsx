// S2 Gold onboarding: connect -> pick a demo profile (GET /packs) -> POST insights -> "What Gold found" -> continue.
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, ErrorState, Header, LoadingState, Screen, Section } from '../components/ui';
import { ConnectRow, GoldFound, PackCard, WhyConnect } from '../components/s2/parts';
import { api, errorMessage, type Insights, type Pack } from '../services/api';
import { signIn } from '../services/firebase';
import { setSession, useSession } from '../store/session';
import { colors, space, type } from '../theme';

const WHY = {
  creator:
    "Connecting your photos and Instagram helps us understand your style and create a storefront that feels like you. You'll review everything before your shop goes live.",
  fan: "Connecting your photos helps us suggest products that fit your life, made in your favorite creators' styles.",
};

export default function S2Onboarding() {
  const router = useRouter();
  const { role: sessionRole } = useSession();
  const role = sessionRole ?? 'fan';
  const creator = role === 'creator';

  const [packs, setPacks] = useState<Pack[] | null>(null);
  const [packsError, setPacksError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);

  const loadPacks = useCallback(async () => {
    setPacksError(null);
    setPacks(null);
    try {
      const { packs } = await api.packs();
      setPacks(packs.filter((p) => p.kind === 'archetype'));
    } catch (e) {
      setPacksError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    loadPacks();
  }, [loadPacks]);

  const attach = async (packId: string) => {
    setPick(packId);
    setConnected(true);
    setAttaching(true);
    setAttachError(null);
    setInsights(null);
    try {
      const user = await signIn();
      setSession({ uid: user.uid, role });
      setInsights(await api.attachInsights(user.uid, packId, role));
    } catch (e) {
      setAttachError(errorMessage(e));
    } finally {
      setAttaching(false);
    }
  };

  const cont = () => router.push(creator ? '/brand' : '/creators');

  return (
    <Screen
      header={<Header onBack={() => router.back()} step={0} />}
      footer={<Button title={creator ? 'Analyze my Brand' : 'Start Shopping'} onPress={cont} disabled={!insights || attaching} />}
    >
      <View style={{ gap: space.sm, marginBottom: space.xs }}>
        <Text style={type.title}>First, the basics</Text>
        <Text style={type.body}>{creator ? 'A few details to make your shop yours.' : 'A couple of details to tailor what you see.'}</Text>
      </View>

      <Text style={[type.label, { paddingHorizontal: space.xs }]}>Connect</Text>
      <Card padded={false}>
        <ConnectRow
          icon="photos"
          title="Camera roll"
          sub={insights?.reading.photos ? `${insights.reading.photos.count.toLocaleString()} photos` : 'For your lifestyle'}
          done={connected}
          onConnect={() => setConnected(true)}
          last={!creator}
        />
        {creator ? <ConnectRow icon="instagram" title="Instagram" sub="For your brand" done={false} last /> : null}
        <WhyConnect text={WHY[role]} note={creator ? "You'll connect Instagram on the next step." : undefined} />
      </Card>
      <Text style={type.caption}>
        This demo uses synthetic profiles: pick one below to connect.
      </Text>

      <Section title="Demo profile" right={packs ? `${packs.length} profiles` : undefined}>
        {packsError ? (
          <ErrorState message={packsError} onRetry={loadPacks} />
        ) : !packs ? (
          <LoadingState label="Loading demo profiles…" />
        ) : packs.length === 0 ? (
          <EmptyState title="No demo profiles" message="The backend returned no archetype packs." actionLabel="Reload" onAction={loadPacks} />
        ) : (
          packs.map((p) => <PackCard key={p.id} pack={p} selected={p.id === pick} onPress={() => attach(p.id)} />)
        )}
      </Section>

      {!pick && packs?.length ? (
        <Text style={[type.caption, { color: colors.muted2, textAlign: 'center' }]}>Choose a demo profile to continue.</Text>
      ) : null}
      {attaching ? <LoadingState label="Connecting Gold…" /> : null}
      {attachError && pick ? <ErrorState title="Couldn't connect Gold" message={attachError} onRetry={() => attach(pick)} /> : null}
      {insights ? <GoldFound reading={insights.reading} /> : null}
    </Screen>
  );
}

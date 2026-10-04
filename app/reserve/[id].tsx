import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { Button } from '@/components/Button';
import { Choice } from '@/components/Field';
import { EmptyState, Screen, ScreenTitle } from '@/components/Screen';
import { PageHeader } from '@/components/PageHeader';
import { PickupSteps } from '@/components/PickupSteps';
import { useSession } from '@/features/session';
import { useT } from '@/i18n';
import { formatVnd } from '@/lib/format';
import { fetchListing, reserveListing } from '@/lib/queries';
import { canReserve, paymentOptions } from '@/lib/reservations';
import type { NearbyListing, PaymentMethod } from '@/lib/types';
import { radius, space, type, useTheme } from '@/theme';

export default function Reserve() {
  const { colors } = useTheme();
  const { t, f } = useT();
  const router = useRouter();
  const { user, refreshProfile } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [listing, setListing] = useState<NearbyListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [portions, setPortions] = useState<'1' | '2' | '3'>('1');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<{ key: string; id: string; method: PaymentMethod } | null>(null);
  const inFlight = useRef(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { void refreshProfile(); }, [refreshProfile]);

  useEffect(() => {
    if (!id) return;
    fetchListing(id)
      .then(setListing)
      .catch(() => setListing(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Screen>
        <View style={styles.centre}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }
  if (!listing) {
    return (
      <Screen>
        <EmptyState title={t.common.errorTitle} body={t.common.errorBody} />
      </Screen>
    );
  }

  const count = Number(portions);
  const total = listing.price_vnd * count;
  const saving = listing.original_price_vnd
    ? (listing.original_price_vnd - listing.price_vnd) * count
    : 0;

  /**
   * Payment options are ordered by what actually works for this audience:
   * cash first, because a meaningful share of users have no bank account at
   * all, then QR at pickup, then available support credit.
   */
  const methods = paymentOptions(total, user?.creditBalanceVnd ?? 0)
    .map((value) => ({ value, label: t.reserve[value] }));
  const effectiveMethod = pending && request.current ? request.current.method
    : methods.some((option) => option.value === method) ? method : 'cash';
  const available = canReserve(listing, now);

  const submit = async () => {
    if (inFlight.current || (!available && !pending)) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const key = `${listing.id}:${count}:${effectiveMethod}`;
    if (request.current?.key !== key) request.current = { key, id: randomUUID(), method: effectiveMethod };
    try {
      const result = await reserveListing({ listingId: listing.id, portions: count,
        paymentMethod: effectiveMethod, requestId: request.current.id });
      if (!result.ok) {
        if (result.reason === 'unknown') {
          setPending(true);
          setError(t.reserve.retryPending);
          return;
        }
        setPending(false);
        setError(result.reason === 'sold_out' ? t.reserve.soldOut
          : result.reason === 'past_pickup_window' ? t.reserve.tooLate
          : result.reason === 'insufficient_credit' ? t.reserve.insufficientCredit
          : result.reason === 'restaurant_unavailable' ? t.reserve.unavailable
          : result.reason === 'not_authenticated' ? t.reserve.signInRequired : t.common.errorBody);
        await refreshProfile();
        return;
      }
      await refreshProfile();
      router.replace({ pathname: '/pass/[orderId]', params: { orderId: result.orderId } });
    } catch {
      // Keep the request ID: a lost response may still have created an order.
      setPending(true);
      setError(t.reserve.retryPending);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <Screen padded={false}>
      <PageHeader title={t.journey.checkoutTitle} backHref={{ pathname: '/offer/[id]', params: { id: listing.id } }} orders />
      <ScrollView contentContainerStyle={styles.content}>
      <PickupSteps current={1} />
      <ScreenTitle title={t.reserve.title} subtitle={listing.title} />

      <View style={styles.form}>
        <Choice
          label={t.reserve.howMany}
          value={portions}
          onChange={setPortions}
          disabled={busy || pending}
          options={(['1', '2', '3'] as const)
            .filter((n) => Number(n) <= listing.portions_left)
            .map((n) => ({ value: n, label: n }))}
        />

        <Choice
          label={t.reserve.payWith}
          value={effectiveMethod}
          onChange={setMethod}
          disabled={busy || pending}
          options={methods}
        />

        <View style={[styles.total, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={styles.totalRow}>
            <Text style={[type.body, { color: colors.inkMuted }]}>{t.reserve.total}</Text>
            <Text style={[type.numeric, styles.figure, { color: colors.ink }]}>
              {total === 0 ? t.common.free : formatVnd(total)}
            </Text>
          </View>
          {saving > 0 ? (
            <Text style={[type.small, { color: colors.brandInk }]}>
              {f(t.reserve.youSave, { amount: formatVnd(saving) })}
            </Text>
          ) : null}
          {effectiveMethod === 'credit' ? (
            <Text style={[type.small, { color: colors.inkFaint }]}>
              {f(t.reserve.creditBalance, {
                amount: formatVnd(user?.creditBalanceVnd ?? 0),
              })}
            </Text>
          ) : null}
        </View>
        <Text style={[type.small, { color: colors.inkMuted }]}>
          {effectiveMethod === 'credit' ? t.reserve.creditTerms : t.reserve.payAtPickup}
        </Text>
        {!available ? <Text style={[type.body, { color: colors.danger }]}>
          {listing.portions_left <= 0 ? t.reserve.soldOut : t.reserve.tooLate}
        </Text> : null}

        {error ? (
          <Text style={[type.body, { color: colors.danger }]}>{error}</Text>
        ) : null}
      </View>
      <Text style={[type.small, styles.qrHint, { color: colors.inkMuted }]}>{t.journey.qrAfterBooking}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Button label={t.reserve.confirm} onPress={() => void submit()} loading={busy}
          disabled={!pending && (!available || count > listing.portions_left)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  qrHint: { paddingTop: space.lg },
  form: { gap: space.xl },
  total: { gap: space.xs, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  figure: { fontVariant: ['tabular-nums'] },
  footer: { padding: space.lg },
});

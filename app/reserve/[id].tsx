import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Choice } from '@/components/Field';
import { EmptyState, Screen, ScreenTitle } from '@/components/Screen';
import { useSession } from '@/features/session';
import { useT } from '@/i18n';
import { formatVnd } from '@/lib/format';
import { fetchListing, reserveListing } from '@/lib/queries';
import type { NearbyListing, PaymentMethod } from '@/lib/types';
import { radius, space, type, useTheme } from '@/theme';

export default function Reserve() {
  const { colors } = useTheme();
  const { t, f } = useT();
  const router = useRouter();
  const { user } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [listing, setListing] = useState<NearbyListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [portions, setPortions] = useState<'1' | '2' | '3'>('1');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const hasCredit = (user?.creditBalanceVnd ?? 0) >= total;

  /**
   * Payment options are ordered by what actually works for this audience:
   * cash first, because a meaningful share of users have no bank account at
   * all, then QR, then the wallets.
   */
  const methods: { value: PaymentMethod; label: string }[] = [
    { value: 'cash', label: t.reserve.cash },
    { value: 'vietqr', label: t.reserve.vietqr },
    { value: 'momo', label: t.reserve.momo },
    { value: 'zalopay', label: t.reserve.zalopay },
    ...(hasCredit ? [{ value: 'credit' as PaymentMethod, label: t.reserve.credit }] : []),
  ];

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await reserveListing({
      listingId: listing.id,
      portions: count,
      paymentMethod: method,
    });
    setBusy(false);

    if (!result.ok) {
      setError(
        result.reason === 'sold_out'
          ? t.reserve.soldOut
          : result.reason === 'past_pickup_window'
            ? t.reserve.tooLate
            : t.common.errorBody,
      );
      return;
    }
    router.replace({ pathname: '/pass/[orderId]', params: { orderId: result.orderId } });
  };

  return (
    <Screen>
      <ScreenTitle title={t.reserve.title} subtitle={listing.title} />

      <View style={styles.form}>
        <Choice
          label={t.reserve.howMany}
          value={portions}
          onChange={setPortions}
          options={(['1', '2', '3'] as const)
            .filter((n) => Number(n) <= listing.portions_left)
            .map((n) => ({ value: n, label: n }))}
        />

        <Choice
          label={t.reserve.payWith}
          value={method}
          onChange={setMethod}
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
          {method === 'credit' ? (
            <Text style={[type.small, { color: colors.inkFaint }]}>
              {f(t.reserve.creditBalance, {
                amount: formatVnd(user?.creditBalanceVnd ?? 0),
              })}
            </Text>
          ) : null}
        </View>

        {error ? (
          <Text style={[type.body, { color: colors.danger }]}>{error}</Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Button label={t.reserve.confirm} onPress={submit} loading={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  form: { gap: space.xl },
  total: { gap: space.xs, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  figure: { fontVariant: ['tabular-nums'] },
  footer: { marginTop: 'auto', paddingVertical: space.lg },
});

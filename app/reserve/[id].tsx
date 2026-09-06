import { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Countdown } from '@/components/Countdown';
import { DishImage } from '@/components/DishImage';
import { Choice } from '@/components/Field';
import { EmptyState, Screen, ScreenTitle, StickyFooter } from '@/components/Screen';
import { useSession } from '@/features/session';
import { useT } from '@/i18n';
import { canReserveNow, freeTrackWindow } from '@/lib/priority';
import { fetchListing, reserveListing } from '@/lib/queries';
import { formatTime, formatVnd } from '@/lib/format';
import { effectiveDeadline } from '@/lib/safety';
import type { NearbyListing, PaymentMethod } from '@/lib/types';
import { space, type, useTheme } from '@/theme';

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
        <EmptyState
          icon="alert-circle-outline"
          title={t.common.errorTitle}
          body={t.common.errorBody}
        />
      </Screen>
    );
  }

  const count = Number(portions);
  const total = listing.price_vnd * count;
  const saving = listing.original_price_vnd
    ? (listing.original_price_vnd - listing.price_vnd) * count
    : 0;

  const credit = user?.creditBalanceVnd ?? 0;
  const hasCredit = credit >= total;
  const deadline = effectiveDeadline(
    new Date(listing.prepared_at),
    listing.handling_class,
    new Date(listing.pickup_until),
  );

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
      creditBalanceVnd: credit,
    });
    setBusy(false);

    if (!result.ok) {
      setError(
        result.reason === 'sold_out'
          ? t.reserve.soldOut
          : result.reason === 'past_pickup_window'
            ? t.reserve.tooLate
            : result.reason === 'priority_window'
              ? f(t.reserve.priorityWindow, {
                  time: formatTime(
                    freeTrackWindow({
                      priceVnd: listing.price_vnd,
                      listedAt: new Date(listing.created_at),
                      deadline,
                      now: new Date(),
                    }).priorityUntil ?? deadline,
                  ),
                })
              : t.common.errorBody,
      );
      return;
    }
    router.replace({ pathname: '/pass/[orderId]', params: { orderId: result.orderId } });
  };

  return (
    <Screen>
      <ScreenTitle title={t.reserve.title} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* What you are buying stays on screen while you choose how to pay. */}
        <Card padded={false} style={styles.summary}>
          <DishImage
            photoUrl={listing.photo_url}
            seed={listing.id}
            handling={listing.handling_class}
            vegetarian={listing.is_vegetarian}
            round="md"
            style={styles.thumb}
          />
          <View style={styles.summaryText}>
            <Text style={[type.heading, { color: colors.ink }]} numberOfLines={1}>
              {listing.title}
            </Text>
            <Text style={[type.small, { color: colors.inkMuted }]} numberOfLines={1}>
              {listing.restaurant_name}
            </Text>
            <Countdown deadline={deadline} size="sm" />
          </View>
        </Card>

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

        <Card style={styles.total}>
          <View style={styles.totalRow}>
            <Text style={[type.body, { color: colors.inkMuted }]}>{t.reserve.total}</Text>
            <Text style={[type.numeric, styles.figure, { color: colors.ink }]}>
              {total === 0 ? t.common.free : formatVnd(total)}
            </Text>
          </View>
          {saving > 0 ? (
            <View style={styles.savingRow}>
              <MaterialCommunityIcons
                name="tag-outline"
                size={15}
                color={colors.brandInk}
              />
              <Text style={[type.smallStrong, { color: colors.brandInk }]}>
                {f(t.reserve.youSave, { amount: formatVnd(saving) })}
              </Text>
            </View>
          ) : null}
          {method === 'credit' ? (
            <Text style={[type.small, { color: colors.inkFaint }]}>
              {f(t.reserve.creditBalance, {
                amount: formatVnd(user?.creditBalanceVnd ?? 0),
              })}
            </Text>
          ) : null}
        </Card>

        {error ? (
          <Card tone="plain" level="none" style={[styles.error, { borderColor: colors.danger }]}>
            <Text style={[type.bodyStrong, { color: colors.danger }]}>{error}</Text>
          </Card>
        ) : null}
      </ScrollView>

      <StickyFooter>
        <Button
          label={t.reserve.confirm}
          icon="check-circle"
          onPress={submit}
          loading={busy}
          disabled={
            !canReserveNow(
              freeTrackWindow({
                priceVnd: listing.price_vnd,
                listedAt: new Date(listing.created_at),
                deadline,
                now: new Date(),
              }),
              credit,
            )
          }
        />
      </StickyFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { gap: space.xl, paddingBottom: space.lg },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  thumb: { width: 72, height: 72 },
  summaryText: { flex: 1, gap: space.xs },
  total: { gap: space.sm },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  savingRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  figure: { fontVariant: ['tabular-nums'] },
  error: { borderWidth: 1.5 },
});

import { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Choice, Field } from '@/components/Field';
import { Screen, ScreenTitle, StickyFooter } from '@/components/Screen';
import { useTabBarClearance } from '@/components/TabBar';
import { useSession } from '@/features/session';
import { useT } from '@/i18n';
import { formatTime, formatVnd } from '@/lib/format';
import { publishListing } from '@/lib/queries';
import {
  PREPARED_BUCKETS,
  bucketRemainingMinutes,
  preparedAtFromBucket,
  safetyDeadline,
  type HandlingClass,
  validateListing,
} from '@/lib/safety';
import type { PreparedBucketId } from '@/lib/safety';
import { radius, space, type, useTheme } from '@/theme';

/**
 * The 30-second listing.
 *
 * This screen decides whether the supply side of the marketplace works at
 * all. Staff use it at closing time, tired, one-handed. Every field here has
 * to earn its place, so: the dish, how many, how much, how it is held, and
 * when it came off the stove. Nothing else.
 *
 * "Prepared at" defaults to now and offers a couple of taps backwards rather
 * than a date picker — the honest answer is almost always "just now" or "half
 * an hour ago", and a picker is where a 30-second flow goes to die.
 */
export default function NewListing() {
  const { colors } = useTheme();
  const { t, f } = useT();
  const router = useRouter();
  const clearance = useTabBarClearance();
  const { user } = useSession();

  const [title, setTitle] = useState('');
  const [portions, setPortions] = useState('4');
  const [price, setPrice] = useState('20000');
  const [originalPrice, setOriginalPrice] = useState('45000');
  const [handling, setHandling] = useState<HandlingClass>('hot');
  const [cookedBucket, setCookedBucket] = useState<PreparedBucketId>('under30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The pessimistic end of whatever range staff picked. "1 – 2 giờ" becomes
   * two hours, not one: nobody at a counter knows the exact minute, and
   * rounding that uncertainty towards the eater is the only direction that
   * cannot hurt them.
   */
  const preparedAt = useMemo(
    () => preparedAtFromBucket(cookedBucket, new Date()),
    [cookedBucket],
  );

  // Shown live, so staff watch the deadline move as they change the handling
  // class. It makes the rule visible instead of a surprise at publish time.
  const deadline = safetyDeadline(preparedAt, handling);

  /**
   * Whether this combination leaves any collectable time at all. Three-hour-old
   * hot food leaves none, and the screen has to say so where the deadline
   * would otherwise be — not print a time that has already passed.
   */
  const listable = bucketRemainingMinutes(cookedBucket, handling) > 0;

  const submit = async () => {
    const now = new Date();
    const pickupFrom = now;
    // Restaurants set their own closing time later; the default asks for the
    // full safety window and the server clamps it either way.
    const pickupUntil = deadline;

    const check = validateListing({
      preparedAt,
      handling,
      pickupFrom,
      pickupUntil,
      now,
    });

    if (!check.ok) {
      setError(
        check.reason === 'prepared_in_future'
          ? t.partner.rejectedFuture
          : check.reason === 'window_ends_before_it_starts'
            ? t.partner.rejectedWindow
            : t.partner.rejectedTooOld,
      );
      return;
    }

    if (!user?.restaurantId) return;
    setError(null);
    setBusy(true);
    try {
      await publishListing({
        restaurantId: user.restaurantId,
        title: title.trim(),
        description: null,
        portions: Number(portions),
        priceVnd: Number(price),
        originalPriceVnd: originalPrice ? Number(originalPrice) : null,
        handling,
        preparedAt,
        pickupFrom,
        pickupUntil,
        isVegetarian: false,
        allergens: [],
        photoUrl: null,
      });
      router.replace('/(partner)');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.common.errorBody);
    } finally {
      setBusy(false);
    }
  };

  const ready = title.trim().length > 0 && Number(portions) > 0;

  return (
    <Screen edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: clearance }]}
      >
        <ScreenTitle title={t.partner.newListing} />

        <Field
          label={t.partner.dish}
          value={title}
          onChangeText={setTitle}
          placeholder={t.partner.dishPlaceholder}
        />

        <View style={styles.pair}>
          <View style={styles.half}>
            <Field
              label={t.partner.portions}
              value={portions}
              onChangeText={(next) => setPortions(next.replace(/\D/g, ''))}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.half}>
            <Field
              label={t.partner.price}
              value={price}
              onChangeText={(next) => setPrice(next.replace(/\D/g, ''))}
              keyboardType="number-pad"
              hint={price ? formatVnd(Number(price)) : undefined}
            />
          </View>
        </View>

        <Field
          label={t.partner.originalPrice}
          value={originalPrice}
          onChangeText={(next) => setOriginalPrice(next.replace(/\D/g, ''))}
          keyboardType="number-pad"
          hint={originalPrice ? formatVnd(Number(originalPrice)) : undefined}
        />

        <Choice
          label={t.partner.handling}
          value={handling}
          onChange={setHandling}
          options={[
            { value: 'hot', label: t.partner.handlingHot, hint: t.partner.handlingHotHint },
            {
              value: 'chilled',
              label: t.partner.handlingChilled,
              hint: t.partner.handlingChilledHint,
            },
            {
              value: 'ambient',
              label: t.partner.handlingAmbient,
              hint: t.partner.handlingAmbientHint,
            },
            {
              value: 'shelf_stable',
              label: t.partner.handlingShelfStable,
              hint: t.partner.handlingShelfStableHint,
            },
          ]}
        />

        <Choice
          label={t.partner.preparedAt}
          value={cookedBucket}
          onChange={setCookedBucket}
          options={PREPARED_BUCKETS.map((bucket) => {
            const left = bucketRemainingMinutes(bucket.id, handling);
            return {
              value: bucket.id,
              label: bucketLabel(bucket.id, t),
              // States the assumption rather than hiding it, and warns before
              // staff fill in the rest of a listing that cannot be published.
              hint:
                left > 0
                  ? f(t.partner.bucketCountedAs, { n: bucket.worstCaseMinutes })
                  : t.partner.bucketTooOld,
            };
          })}
        />

        {/* Amber, and the only amber on the screen: this is the countdown
            the eater will see, shown to staff before they commit to it.

            Unless there is no window left at all, in which case showing a
            clock time that has already passed — styled exactly like a valid
            one — would read as a deadline rather than as a refusal. That case
            is red and says what is actually wrong. */}
        <View
          style={[
            styles.deadline,
            { backgroundColor: listable ? colors.urgentSoft : colors.dangerSoft },
          ]}
        >
          <MaterialCommunityIcons
            name={listable ? 'clock-fast' : 'alert-circle-outline'}
            size={22}
            color={listable ? colors.urgent : colors.danger}
          />
          <View style={styles.deadlineText}>
            <Text
              style={[type.bodyStrong, { color: listable ? colors.urgent : colors.danger }]}
            >
              {listable
                ? f(t.partner.computedDeadline, { time: formatTime(deadline) })
                : t.partner.noWindowLeft}
            </Text>
            <Text style={[type.small, { color: listable ? colors.urgent : colors.danger }]}>
              {listable ? t.partner.computedDeadlineHint : t.partner.noWindowLeftHint}
            </Text>
          </View>
        </View>

        {error ? (
          <Card tone="plain" level="none" style={[styles.error, { borderColor: colors.danger }]}>
            <Text style={[type.bodyStrong, { color: colors.danger }]}>{error}</Text>
          </Card>
        ) : null}
      </ScrollView>

      <StickyFooter>
        <Button
          label={busy ? t.partner.publishing : t.partner.publish}
          icon="check-circle"
          onPress={submit}
          loading={busy}
          disabled={!ready}
        />
      </StickyFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: space.xl },
  pair: { flexDirection: 'row', gap: space.sm },
  half: { flex: 1 },
  deadline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
  },
  deadlineText: { flex: 1, gap: space.xs },
  error: { borderWidth: 1.5 },
});

/** The four ranges, in the partner's language. */
function bucketLabel(id: PreparedBucketId, t: ReturnType<typeof useT>['t']): string {
  switch (id) {
    case 'under30':
      return t.partner.cookedUnder30;
    case 'under60':
      return t.partner.cooked30to60;
    case 'under120':
      return t.partner.cooked1to2h;
    case 'under180':
      return t.partner.cooked2to3h;
  }
}

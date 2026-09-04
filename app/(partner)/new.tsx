import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Choice, Field } from '@/components/Field';
import { Screen, ScreenTitle } from '@/components/Screen';
import { useSession } from '@/features/session';
import { useT } from '@/i18n';
import { formatTime, formatVnd } from '@/lib/format';
import { publishListing } from '@/lib/queries';
import { safetyDeadline, validateListing, type HandlingClass } from '@/lib/safety';
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
  const { user } = useSession();

  const [title, setTitle] = useState('');
  const [portions, setPortions] = useState('4');
  const [price, setPrice] = useState('20000');
  const [originalPrice, setOriginalPrice] = useState('45000');
  const [handling, setHandling] = useState<HandlingClass>('hot');
  const [cookedMinutesAgo, setCookedMinutesAgo] = useState<'0' | '30' | '60' | '120'>('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preparedAt = useMemo(
    () => new Date(Date.now() - Number(cookedMinutesAgo) * 60_000),
    [cookedMinutesAgo],
  );

  // Shown live, so staff watch the deadline move as they change the handling
  // class. It makes the rule visible instead of a surprise at publish time.
  const deadline = safetyDeadline(preparedAt, handling);

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
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
          value={cookedMinutesAgo}
          onChange={setCookedMinutesAgo}
          options={[
            { value: '0', label: 'Vừa xong' },
            { value: '30', label: '30 phút trước' },
            { value: '60', label: '1 giờ trước' },
            { value: '120', label: '2 giờ trước' },
          ]}
        />

        <View style={[styles.deadline, { backgroundColor: colors.urgentSoft }]}>
          <Text style={[type.bodyStrong, { color: colors.urgent }]}>
            {f(t.partner.computedDeadline, { time: formatTime(deadline) })}
          </Text>
          <Text style={[type.small, { color: colors.urgent }]}>
            {t.partner.computedDeadlineHint}
          </Text>
        </View>

        {error ? (
          <Text style={[type.body, { color: colors.danger }]}>{error}</Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={busy ? t.partner.publishing : t.partner.publish}
          onPress={submit}
          loading={busy}
          disabled={!ready}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: space.lg, paddingBottom: space.xl },
  pair: { flexDirection: 'row', gap: space.sm },
  half: { flex: 1 },
  deadline: { gap: space.xs, padding: space.lg, borderRadius: radius.lg },
  footer: { paddingVertical: space.md },
});

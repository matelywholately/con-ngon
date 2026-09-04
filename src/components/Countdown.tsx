import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useT } from '@/i18n';
import { minutesRemaining, urgencyOf, type Urgency } from '@/lib/safety';
import { radius, space, type, urgencyColor, useTheme } from '@/theme';

/**
 * The countdown is the hero element of the whole product: scarcity is what
 * makes the model work, so it is the loudest thing on every card.
 *
 * It ticks once a minute rather than once a second. The display has
 * minute granularity, a per-second timer would be pure battery cost, and a
 * meaningful share of users are on old Android handsets.
 */
export function useMinutesLeft(deadline: Date): number {
  const [left, setLeft] = useState(() => minutesRemaining(deadline, new Date()));

  useEffect(() => {
    const tick = () => setLeft(minutesRemaining(deadline, new Date()));
    tick();
    // Align to the next minute boundary so the number changes when the
    // clock does, then settle into a steady interval.
    const msToBoundary = 60_000 - (Date.now() % 60_000);
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      tick();
      interval = setInterval(tick, 60_000);
    }, msToBoundary);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [deadline]);

  return left;
}

export function Countdown({
  deadline,
  size = 'md',
}: {
  deadline: Date;
  size?: 'sm' | 'md' | 'lg';
}) {
  const { colors } = useTheme();
  const { t, f } = useT();
  const left = useMinutesLeft(deadline);
  const urgency: Urgency = urgencyOf(deadline, new Date());
  const tone = urgencyColor(colors, urgency);

  // Three scales, three strings. Interpolating a "1:09" clock into a
  // "{n} minutes" template reads as nonsense in both languages.
  const label =
    urgency === 'expired'
      ? t.discover.expired
      : left < 60
        ? f(t.discover.minutesLeft, { n: left })
        : left % 60 === 0
          ? f(t.discover.hoursLeft, { h: Math.floor(left / 60) })
          : f(t.discover.hoursMinutesLeft, {
              h: Math.floor(left / 60),
              m: left % 60,
            });

  return (
    <View
      style={[
        styles.pill,
        size === 'lg' && styles.pillLg,
        { backgroundColor: tone.bg },
      ]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <View style={[styles.dot, { backgroundColor: tone.fg }]} />
      <Text
        style={[
          size === 'lg' ? type.bodyStrong : type.small,
          styles.text,
          { color: tone.fg },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs + 2,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs + 1,
    borderRadius: radius.pill,
  },
  pillLg: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontVariant: ['tabular-nums'] },
});

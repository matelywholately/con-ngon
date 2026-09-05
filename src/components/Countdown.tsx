import { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
  onImage = false,
}: {
  deadline: Date;
  size?: 'sm' | 'md' | 'lg';
  /**
   * The chip is sitting on a photograph rather than on a card, so it goes
   * solid — white, then amber, then red — instead of tinted.
   */
  onImage?: boolean;
}) {
  const { colors } = useTheme();
  const { t, f } = useT();
  const left = useMinutesLeft(deadline);
  const urgency: Urgency = urgencyOf(deadline, new Date());
  const tone = urgencyColor(colors, urgency, onImage);

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

  const iconSize = size === 'lg' ? 18 : size === 'sm' ? 13 : 15;

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
      <MaterialCommunityIcons
        // A running clock for the last half hour. It is the only moment the
        // icon changes, so the change itself carries meaning.
        name={urgency === 'urgent' ? 'clock-fast' : 'clock-outline'}
        size={iconSize}
        color={tone.fg}
      />
      <Text
        style={[
          size === 'lg' ? type.bodyStrong : size === 'sm' ? type.tiny : type.smallStrong,
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
    gap: space.xs + 1,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
  },
  pillLg: {
    gap: space.sm,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm + 2,
  },
  text: { fontVariant: ['tabular-nums'] },
});

import { useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { setLocale, useT, type Locale } from '@/i18n';
import { onboardingTints, overlay, radius, space, type, useTheme } from '@/theme';

/**
 * Onboarding is a real swipeable carousel now, not three stacked cards that
 * only looked tappable. Each slide is one claim, illustrated, because the
 * three claims are the entire pitch: cheap, honest about what you get, and
 * safe to eat.
 */
export default function Welcome() {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const slides = [
    {
      title: t.onboarding.slide1Title,
      body: t.onboarding.slide1Body,
      icon: 'silverware-fork-knife',
      tint: onboardingTints[0]!,
    },
    {
      title: t.onboarding.slide2Title,
      body: t.onboarding.slide2Body,
      icon: 'bowl-mix',
      tint: onboardingTints[1]!,
    },
    {
      title: t.onboarding.slide3Title,
      body: t.onboarding.slide3Body,
      icon: 'shield-check',
      tint: onboardingTints[2]!,
    },
  ] as const;

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  const last = index === slides.length - 1;

  const advance = () => {
    if (last) {
      router.push('/(auth)/phone');
      return;
    }
    const next = index + 1;
    scroller.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };

  return (
    <Screen padded={false}>
      <View style={styles.top}>
        <Text style={[type.titleLg, { color: colors.ink }]}>
          Còn <Text style={{ color: colors.brand }}>Ngon</Text>
        </Text>
        <View style={styles.langRow}>
          {(['vi', 'en'] as const).map((code: Locale) => {
            const on = locale === code;
            return (
              <Pressable
                key={code}
                onPress={() => setLocale(code)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[
                  styles.lang,
                  { backgroundColor: on ? colors.brandSoft : 'transparent' },
                ]}
              >
                <Text
                  style={[type.tiny, { color: on ? colors.brandInk : colors.inkFaint }]}
                >
                  {code === 'vi' ? 'VI' : 'EN'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.carousel}
      >
        {slides.map((slide) => (
          <View key={slide.title} style={[styles.slide, { width }]}>
            <LinearGradient
              colors={slide.tint}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.art}
            >
              <MaterialCommunityIcons
                name={slide.icon}
                size={84}
                color={overlay.slideGlyph}
              />
            </LinearGradient>
            <Text style={[type.display, styles.slideTitle, { color: colors.ink }]}>
              {slide.title}
            </Text>
            <Text style={[type.body, styles.slideBody, { color: colors.inkMuted }]}>
              {slide.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {slides.map((slide, i) => (
          <View
            key={slide.title}
            style={[
              styles.dot,
              i === index && styles.dotOn,
              { backgroundColor: i === index ? colors.brand : colors.line },
            ]}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Button label={last ? t.onboarding.start : t.common.next} onPress={advance} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  langRow: { flexDirection: 'row', gap: space.xs },
  lang: {
    minWidth: 38,
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: space.sm - 2,
    borderRadius: radius.pill,
  },
  carousel: { flex: 1 },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
  },
  art: {
    width: '100%',
    maxWidth: 320,
    height: 236,
    borderRadius: radius.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  slideTitle: { textAlign: 'center' },
  slideBody: { textAlign: 'center', maxWidth: 340 },
  dots: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: space.sm,
    paddingBottom: space.xl,
  },
  dot: { width: 7, height: 7, borderRadius: radius.pill },
  // The active dot stretches rather than growing, so the row does not jump.
  dotOn: { width: 22 },
  footer: { paddingHorizontal: space.lg, paddingBottom: space.lg },
});

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { setLocale, useT, type Locale } from '@/i18n';
import { radius, space, type, useTheme } from '@/theme';

export default function Welcome() {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const router = useRouter();
  const [index, setIndex] = useState(0);

  const slides = [
    { title: t.onboarding.slide1Title, body: t.onboarding.slide1Body },
    { title: t.onboarding.slide2Title, body: t.onboarding.slide2Body },
    { title: t.onboarding.slide3Title, body: t.onboarding.slide3Body },
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.langRow}>
          {(['vi', 'en'] as const).map((code: Locale) => (
            <Pressable
              key={code}
              onPress={() => setLocale(code)}
              accessibilityRole="button"
              accessibilityState={{ selected: locale === code }}
              style={[
                styles.lang,
                {
                  backgroundColor: locale === code ? colors.brandSoft : 'transparent',
                  borderColor: locale === code ? 'transparent' : colors.line,
                },
              ]}
            >
              <Text
                style={[
                  type.small,
                  { color: locale === code ? colors.brandInk : colors.inkMuted },
                ]}
              >
                {code === 'vi' ? 'Tiếng Việt' : 'English'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.brand}>
          <Text style={[type.display, styles.wordmark, { color: colors.ink }]}>
            Còn{'\n'}
            <Text style={{ color: colors.brand }}>Ngon</Text>
          </Text>
        </View>

        <View style={styles.slides}>
          {slides.map((slide, i) => (
            <Pressable
              key={slide.title}
              onPress={() => setIndex(i)}
              style={[
                styles.slide,
                {
                  backgroundColor: i === index ? colors.surface : 'transparent',
                  borderColor: i === index ? colors.line : 'transparent',
                },
              ]}
            >
              <Text style={[type.heading, { color: colors.ink }]}>{slide.title}</Text>
              <Text style={[type.body, { color: colors.inkMuted }]}>{slide.body}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label={t.onboarding.start} onPress={() => router.push('/(auth)/phone')} />
        <Button label={t.restaurantPortal.title} variant="ghost" onPress={() => router.push('/restaurant')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: space.xl, gap: space.xl },
  langRow: { flexDirection: 'row', gap: space.sm, paddingTop: space.md },
  lang: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  brand: { paddingTop: space.lg },
  wordmark: { fontSize: 52, lineHeight: 54, letterSpacing: -1.5 },
  slides: { gap: space.sm },
  slide: {
    gap: space.xs,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  footer: { paddingVertical: space.lg },
});

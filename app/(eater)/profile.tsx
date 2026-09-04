import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Screen, ScreenTitle } from '@/components/Screen';
import { useSession } from '@/features/session';
import { setLocale, useT, type Locale } from '@/i18n';
import { radius, space, type, useTheme } from '@/theme';

export default function Profile() {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const router = useRouter();
  const { user, signOut, setActiveRole } = useSession();

  return (
    <Screen edges={['top']}>
      <ScreenTitle title={t.profile.title} subtitle={user?.phone ?? undefined} />

      <View style={styles.section}>
        <Text style={[type.label, { color: colors.inkFaint }]}>
          {t.profile.language.toUpperCase()}
        </Text>
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
                  backgroundColor: locale === code ? colors.brand : colors.surface,
                  borderColor: locale === code ? colors.brand : colors.line,
                },
              ]}
            >
              <Text
                style={[
                  type.bodyStrong,
                  { color: locale === code ? colors.onBrand : colors.ink },
                ]}
              >
                {code === 'vi' ? 'Tiếng Việt' : 'English'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label={t.safety.title}
          variant="secondary"
          onPress={() => router.push('/safety')}
        />
        {user?.restaurantId ? (
          <Button
            label={t.profile.switchToPartner}
            variant="secondary"
            onPress={() => {
              setActiveRole('partner_staff');
              router.replace('/(partner)');
            }}
          />
        ) : null}
        <Button
          label={t.auth.signOut}
          variant="ghost"
          onPress={() => {
            void signOut();
            router.replace('/(auth)/welcome');
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  langRow: { flexDirection: 'row', gap: space.sm },
  lang: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  actions: { marginTop: 'auto', gap: space.sm, paddingVertical: space.lg },
});

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen, ScreenTitle, SectionLabel } from '@/components/Screen';
import { useTabBarClearance } from '@/components/TabBar';
import { useSession } from '@/features/session';
import { setLocale, useT, type Locale } from '@/i18n';
import { radius, space, type, useTheme } from '@/theme';

export default function Profile() {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const router = useRouter();
  const clearance = useTabBarClearance();
  const { user, signOut, setActiveRole } = useSession();

  return (
    <Screen edges={['top']}>
      <ScreenTitle title={t.profile.title} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: clearance }]}
      >
        <Card style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: colors.brandSoft }]}>
            <MaterialCommunityIcons
              name="account"
              size={26}
              color={colors.brandInk}
            />
          </View>
          <View style={styles.identityText}>
            <Text style={[type.heading, { color: colors.ink }]} numberOfLines={1}>
              {user?.phone ?? t.profile.title}
            </Text>
            {/* Deliberately no credit balance here. A support credit is
                applied silently at checkout; putting it on the account screen
                would label the person carrying it. */}
            <Text style={[type.small, { color: colors.inkFaint }]}>
              {t.common.appName}
            </Text>
          </View>
        </Card>

        <View style={styles.section}>
          <SectionLabel label={t.profile.language} />
          <View style={styles.langRow}>
            {(['vi', 'en'] as const).map((code: Locale) => {
              const on = locale === code;
              return (
                <Pressable
                  key={code}
                  onPress={() => setLocale(code)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [
                    styles.lang,
                    { backgroundColor: on ? colors.brand : colors.surface, opacity: pressed ? 0.88 : 1 },
                  ]}
                >
                  <Text
                    style={[type.bodyStrong, { color: on ? colors.onBrand : colors.ink }]}
                  >
                    {code === 'vi' ? 'Tiếng Việt' : 'English'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            label={t.safety.title}
            icon="shield-check-outline"
            variant="secondary"
            onPress={() => router.push('/safety')}
          />
          {user?.restaurantId ? (
            <Button
              label={t.profile.switchToPartner}
              icon="storefront-outline"
              variant="secondary"
              onPress={() => {
                setActiveRole('partner_staff');
                router.replace('/(partner)');
              }}
            />
          ) : null}
          <Button
            label={t.auth.signOut}
            icon="logout"
            variant="ghost"
            onPress={() => {
              void signOut();
              router.replace('/(auth)/welcome');
            }}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: space.xl, flexGrow: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: { flex: 1, gap: 1 },
  section: { gap: space.sm },
  langRow: { flexDirection: 'row', gap: space.sm },
  lang: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.md + 2,
    borderRadius: radius.md,
  },
  actions: { marginTop: 'auto', gap: space.sm },
});

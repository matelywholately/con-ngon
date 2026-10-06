import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { Screen, ScreenTitle } from '@/components/Screen';
import { useSession } from '@/features/session';
import { setLocale, useT, type Locale } from '@/i18n';
import { formatVnd } from '@/lib/format';
import { radius, space, type, useTheme } from '@/theme';

export function AccountScreen({ staff = false }: { staff?: boolean }) {
  const { colors } = useTheme();
  const { t, f, locale } = useT();
  const router = useRouter();
  const { user, signOut, refreshProfile } = useSession();
  useFocusEffect(useCallback(() => { void refreshProfile(); }, [refreshProfile]));
  return <Screen padded={false} edges={['top']}>
    {staff ? <View style={styles.staffTitle}><ScreenTitle title={t.restaurantPortal.account} /></View>
      : <PageHeader title={t.profile.title} orders />}
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {user?.name ? <Text style={[type.title, { color: colors.ink }]}>{user.name}</Text> : null}
        <Text style={[type.body, { color: colors.inkMuted }]}>{user?.phone}</Text>
        {!staff ? <Text style={[type.heading, { color: colors.brandInk }]}>
          {f(t.profile.creditBalance, { amount: formatVnd(user?.creditBalanceVnd ?? 0) })}
        </Text> : null}
      </View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Text style={[type.label, { color: colors.inkFaint }]}>{t.profile.preferences.toUpperCase()}</Text>
        <Text style={[type.bodyStrong, { color: colors.ink }]}>{t.profile.language}</Text>
        <View style={styles.langRow}>
          {(['vi', 'en'] as const).map((code: Locale) => <Pressable key={code}
            onPress={() => setLocale(code)} accessibilityRole="button"
            accessibilityState={{ selected: locale === code }}
            style={[styles.lang, { backgroundColor: locale === code ? colors.brand : colors.surface,
              borderColor: locale === code ? colors.brand : colors.line }]}>
            <Text style={[type.bodyStrong, { color: locale === code ? colors.onBrand : colors.ink }]}>
              {code === 'vi' ? t.common.vietnamese : t.common.english}
            </Text>
          </Pressable>)}
        </View>
      </View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Text style={[type.label, { color: colors.inkFaint }]}>{t.profile.support.toUpperCase()}</Text>
        <Button label={t.safety.title} variant="secondary" onPress={() => router.push('/safety')} />
      </View>
      <Button label={t.auth.signOut} variant="ghost" onPress={async () => {
        await signOut();
        router.replace(staff ? '/restaurant' : '/(auth)/welcome');
      }} />
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
  staffTitle: { paddingHorizontal: space.lg },
  card: { gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  langRow: { flexDirection: 'row', gap: space.sm },
  lang: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.md, borderWidth: 1 },
});

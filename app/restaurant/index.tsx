import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { Screen } from '@/components/Screen';
import { useSession } from '@/features/session';
import { useT } from '@/i18n';
import { canAccessRestaurant } from '@/lib/access';
import { radius, space, type, useTheme } from '@/theme';

export default function RestaurantPortal() {
  const { colors } = useTheme();
  const { t } = useT();
  const { user, loading, signOut } = useSession();
  const router = useRouter();
  const features = [
    { icon: 'food-outline' as const, title: t.restaurantPortal.listingsTitle, body: t.restaurantPortal.listingsBody },
    { icon: 'account-clock-outline' as const, title: t.restaurantPortal.ordersTitle, body: t.restaurantPortal.ordersBody },
    { icon: 'qrcode-scan' as const, title: t.restaurantPortal.pickupTitle, body: t.restaurantPortal.pickupBody },
  ];
  return <Screen padded={false}>
    <PageHeader title={t.restaurantPortal.title} backHref="/" />
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.hero, { backgroundColor: colors.brandSoft }]}>
        <MaterialCommunityIcons name="storefront-outline" size={44} color={colors.brandInk} />
        <Text style={[type.display, { color: colors.brandInk }]}>{t.restaurantPortal.headline}</Text>
        <Text style={[type.body, { color: colors.brandInk }]}>{t.restaurantPortal.body}</Text>
      </View>
      {features.map(feature => <View key={feature.title} style={[styles.feature, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <MaterialCommunityIcons name={feature.icon} size={26} color={colors.brand} />
        <View style={styles.featureText}>
          <Text style={[type.heading, { color: colors.ink }]}>{feature.title}</Text>
          <Text style={[type.body, { color: colors.inkMuted }]}>{feature.body}</Text>
        </View>
      </View>)}
      {loading ? <ActivityIndicator color={colors.brand} /> : canAccessRestaurant(user) ?
        <Button label={t.restaurantPortal.open} onPress={() => router.replace('/restaurant/today')} />
        : user ? <View style={[styles.restricted, { borderColor: colors.line }]}>
          <Text style={[type.heading, { color: colors.ink }]}>{t.restaurantPortal.restrictedTitle}</Text>
          <Text style={[type.body, { color: colors.inkMuted }]}>{t.restaurantPortal.restrictedBody}</Text>
          <Button label={t.restaurantPortal.anotherAccount} variant="secondary" onPress={async () => {
            await signOut();
            router.push({ pathname: '/(auth)/phone', params: { destination: 'restaurant' } });
          }} />
        </View> : <Button label={t.restaurantPortal.signIn} onPress={() =>
          router.push({ pathname: '/(auth)/phone', params: { destination: 'restaurant' } })} />}
      <Button label={t.restaurantPortal.marketplace} variant="ghost" onPress={() => router.replace('/')} />
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md },
  hero: { padding: space.xl, gap: space.md, borderRadius: radius.lg },
  feature: { flexDirection: 'row', padding: space.lg, gap: space.md, borderWidth: 1, borderRadius: radius.lg },
  featureText: { flex: 1, gap: space.xs },
  restricted: { padding: space.lg, borderWidth: 1, borderRadius: radius.lg, gap: space.md },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useT } from '@/i18n';
import { HIT_SIZE, radius, space, type, useTheme } from '@/theme';

export function PageHeader({ title, backHref, orders = false }: {
  title: string; backHref?: Href; orders?: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useT();
  const router = useRouter();
  return (
    <View style={[styles.header, { borderBottomColor: colors.line }]}>
      {backHref ? <Pressable accessibilityRole="button" accessibilityLabel={t.common.back}
        onPress={() => router.canGoBack() ? router.back() : router.replace(backHref)}
        style={[styles.icon, { backgroundColor: colors.surface }]}>
        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.ink} />
      </Pressable> : <MaterialCommunityIcons name="bowl-mix-outline" size={28} color={colors.brand} />}
      <View style={styles.titles}>
        <Text style={[type.label, { color: colors.brandInk }]}>{t.common.appName}</Text>
        <Text style={[type.heading, { color: colors.ink }]}>{title}</Text>
      </View>
      {orders ? <Pressable accessibilityRole="button" accessibilityLabel={t.orders.title}
        onPress={() => router.push('/(eater)/orders')}
        style={[styles.orders, { backgroundColor: colors.brandSoft }]}>
        <MaterialCommunityIcons name="qrcode" size={24} color={colors.brandInk} />
        <Text style={[type.label, styles.ordersLabel, { color: colors.brandInk }]}>{t.pass.headerShortcut}</Text>
      </Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingVertical: space.sm, borderBottomWidth: 1 },
  titles: { flex: 1, gap: space.xs },
  icon: { width: HIT_SIZE, height: HIT_SIZE, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  orders: { minWidth: HIT_SIZE, minHeight: HIT_SIZE, paddingHorizontal: space.sm,
    alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, gap: 2 },
  ordersLabel: { fontSize: 10 },
});

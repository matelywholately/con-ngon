import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useT } from '@/i18n';
import { encodePickupQr } from '@/lib/pickupQr';
import type { OrderWithListing } from '@/lib/types';
import { radius, space, type, useTheme } from '@/theme';

export function PickupQrCard({ order }: { order: OrderWithListing }) {
  const { colors } = useTheme();
  const { t } = useT();
  const [failed, setFailed] = useState(false);
  let value: string | null = null;
  try {
    value = encodePickupQr({ restaurantId: order.listing.restaurant.id,
      orderId: order.id, code: order.pickup_code });
  } catch { /* The manual code remains available if the read model is older. */ }
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
    <Text style={[type.heading, { color: colors.ink }]}>{t.pass.showThis}</Text>
    {value && !failed ? <View accessible accessibilityRole="image" accessibilityLabel={t.pass.qrLabel}>
      <QRCode value={value} size={204} quietZone={20} color="#000000" backgroundColor="#ffffff"
        ecl="M" testID="pickup-qr" onError={() => setFailed(true)} />
    </View> : <Text style={[type.small, { color: colors.danger }]}>{t.pass.qrFailed}</Text>}
    <Text style={[type.small, styles.hint, { color: colors.inkMuted }]}>{t.pass.qrHint}</Text>
    <View style={[styles.manual, { borderTopColor: colors.line }]}>
      <Text style={[type.small, { color: colors.inkFaint }]}>{t.pass.manualCode}</Text>
      <Text style={[type.display, styles.code, { color: colors.brandInk }]}>{order.pickup_code}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: space.sm, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  hint: { textAlign: 'center' },
  manual: { width: '100%', alignItems: 'center', gap: space.xs, paddingTop: space.md, borderTopWidth: 1 },
  code: { letterSpacing: 6, fontVariant: ['tabular-nums'] },
});

import { StyleSheet, Text, View } from 'react-native';
import { useT } from '@/i18n';
import { radius, space, type, useTheme } from '@/theme';

export function PickupSteps({ current }: { current: 0 | 1 | 2 }) {
  const { colors } = useTheme();
  const { t } = useT();
  return <View style={styles.row}>
    {[t.journey.meal, t.journey.reserve, t.journey.pickup].map((label, index) =>
      <View key={label} style={styles.step}>
        <Text style={[type.label, styles.number, {
          backgroundColor: index <= current ? colors.brand : colors.surfaceAlt,
          color: index <= current ? colors.onBrand : colors.inkFaint,
        }]}>{index + 1}</Text>
        <Text style={[type.small, { color: index === current ? colors.brandInk : colors.inkFaint }]}>{label}</Text>
      </View>)}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm, paddingVertical: space.lg },
  step: { flexDirection: 'row', gap: space.xs, alignItems: 'center', flexShrink: 1 },
  number: { width: 22, height: 22, lineHeight: 22, borderRadius: radius.pill, textAlign: 'center', overflow: 'hidden' },
});

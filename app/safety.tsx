import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Screen, ScreenTitle } from '@/components/Screen';
import { useT } from '@/i18n';
import { HANDLING_RULES } from '@/lib/safety';
import { radius, space, type, useTheme } from '@/theme';

/**
 * Reachable from every listing. Written in plain language, not legal
 * language: the people who most need this app are the least likely to read
 * a wall of terms.
 */
export default function SafetyGuide() {
  const { colors } = useTheme();
  const { t } = useT();
  const router = useRouter();

  const classes = [
    { key: 'hot', label: t.partner.handlingHot, hint: t.partner.handlingHotHint },
    { key: 'chilled', label: t.partner.handlingChilled, hint: t.partner.handlingChilledHint },
    { key: 'ambient', label: t.partner.handlingAmbient, hint: t.partner.handlingAmbientHint },
    {
      key: 'shelf_stable',
      label: t.partner.handlingShelfStable,
      hint: t.partner.handlingShelfStableHint,
    },
  ] as const;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScreenTitle title={t.safety.title} />

        <View style={[styles.block, { backgroundColor: colors.brandSoft }]}>
          <Text style={[type.body, { color: colors.brandInk }]}>{t.safety.intro}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[type.heading, { color: colors.ink }]}>{t.safety.ruleTitle}</Text>
          <Text style={[type.body, { color: colors.inkMuted }]}>{t.safety.ruleBody}</Text>
        </View>

        <View style={styles.section}>
          {classes.map((entry) => {
            const rule = HANDLING_RULES[entry.key];
            const usable = rule.maxDangerZoneMinutes - rule.consumerBufferMinutes;
            const hours = Math.floor(usable / 60);
            const minutes = usable % 60;
            return (
              <View
                key={entry.key}
                style={[styles.rule, { backgroundColor: colors.surface, borderColor: colors.line }]}
              >
                <View style={styles.ruleTop}>
                  <Text style={[type.bodyStrong, { color: colors.ink }]}>{entry.label}</Text>
                  <Text style={[type.bodyStrong, styles.figure, { color: colors.urgent }]}>
                    {hours}
                    {t.common.hoursShort}
                    {minutes > 0 ? ` ${minutes}${t.common.minutesShort}` : ''}
                  </Text>
                </View>
                <Text style={[type.small, { color: colors.inkMuted }]}>{entry.hint}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={[type.heading, { color: colors.ink }]}>{t.safety.reportTitle}</Text>
          <Text style={[type.body, { color: colors.inkMuted }]}>{t.safety.reportBody}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label={t.common.done} onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: space.xl, gap: space.lg },
  block: { padding: space.lg, borderRadius: radius.lg },
  section: { gap: space.sm },
  rule: { gap: space.xs, padding: space.md, borderRadius: radius.md, borderWidth: 1 },
  ruleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  figure: { fontVariant: ['tabular-nums'] },
  footer: { paddingVertical: space.lg },
});

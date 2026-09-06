import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen, ScreenTitle, StickyFooter } from '@/components/Screen';
import { useT } from '@/i18n';
import { HANDLING_RULES } from '@/lib/safety';
import { radius, space, type, useTheme } from '@/theme';

/**
 * Reachable from every listing and from the home screen. Written in plain
 * language, not legal language: the people who most need this app are the
 * least likely to read a wall of terms.
 */
export default function SafetyGuide() {
  const { colors } = useTheme();
  const { t } = useT();
  const router = useRouter();

  const classes = [
    { key: 'hot', label: t.partner.handlingHot, hint: t.partner.handlingHotHint, icon: 'fire' },
    {
      key: 'chilled',
      label: t.partner.handlingChilled,
      hint: t.partner.handlingChilledHint,
      icon: 'snowflake',
    },
    {
      key: 'ambient',
      label: t.partner.handlingAmbient,
      hint: t.partner.handlingAmbientHint,
      icon: 'bread-slice',
    },
    {
      key: 'shelf_stable',
      label: t.partner.handlingShelfStable,
      hint: t.partner.handlingShelfStableHint,
      icon: 'package-variant-closed',
    },
  ] as const;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScreenTitle title={t.safety.title} />

        <Card tone="brand" level="none" style={styles.intro}>
          <MaterialCommunityIcons name="shield-check" size={22} color={colors.brandInk} />
          <Text style={[type.body, styles.introText, { color: colors.brandInk }]}>
            {t.safety.intro}
          </Text>
        </Card>

        <View style={styles.section}>
          <Text style={[type.title, { color: colors.ink }]}>{t.safety.ruleTitle}</Text>
          <Text style={[type.body, { color: colors.inkMuted }]}>{t.safety.ruleBody}</Text>
        </View>

        <View style={styles.rules}>
          {classes.map((entry) => {
            const rule = HANDLING_RULES[entry.key];
            const usable = rule.maxDangerZoneMinutes - rule.consumerBufferMinutes;
            const hours = Math.floor(usable / 60);
            const minutes = usable % 60;
            return (
              <Card key={entry.key} style={styles.rule}>
                <View style={[styles.ruleIcon, { backgroundColor: colors.surfaceSunken }]}>
                  <MaterialCommunityIcons
                    name={entry.icon}
                    size={19}
                    color={colors.inkMuted}
                  />
                </View>
                <View style={styles.ruleText}>
                  <Text style={[type.bodyStrong, { color: colors.ink }]}>{entry.label}</Text>
                  <Text style={[type.small, { color: colors.inkMuted }]}>{entry.hint}</Text>
                </View>
                {/* Amber, because this figure *is* the countdown, stated as a
                    rule rather than as a running clock. */}
                <Text style={[type.bodyStrong, styles.figure, { color: colors.urgent }]}>
                  {hours}
                  {t.common.hoursShort}
                  {minutes > 0 ? ` ${minutes}${t.common.minutesShort}` : ''}
                </Text>
              </Card>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={[type.title, { color: colors.ink }]}>{t.safety.reportTitle}</Text>
          <Text style={[type.body, { color: colors.inkMuted }]}>{t.safety.reportBody}</Text>
        </View>
      </ScrollView>

      <StickyFooter>
        <Button label={t.common.done} onPress={() => router.back()} />
      </StickyFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: space.xl, gap: space.xl },
  intro: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  introText: { flex: 1 },
  section: { gap: space.sm },
  rules: { gap: space.md },
  rule: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  ruleIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleText: { flex: 1, gap: 1 },
  figure: { fontVariant: ['tabular-nums'] },
});

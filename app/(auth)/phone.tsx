import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { RoundButton } from '@/components/Chip';
import { Screen, ScreenTitle, StickyFooter } from '@/components/Screen';
import { useSession } from '@/features/session';
import { useT } from '@/i18n';
import { normalisePhone } from '@/lib/format';
import { space, type, useTheme } from '@/theme';

export default function PhoneScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const router = useRouter();
  const { signInWithPhone } = useSession();

  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const phone = normalisePhone(raw);
    if (!phone) {
      setError(t.auth.invalidPhone);
      return;
    }
    setError(null);
    setBusy(true);
    const result = await signInWithPhone(phone);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? t.common.errorBody);
      return;
    }
    router.push({ pathname: '/(auth)/verify', params: { phone } });
  };

  return (
    <Screen>
      <View style={styles.nav}>
        <RoundButton
          icon="arrow-left"
          accessibilityLabel={t.common.back}
          onPress={() => router.back()}
        />
      </View>

      <ScreenTitle title={t.auth.phoneTitle} subtitle={t.auth.phoneBody} />

      <View style={styles.form}>
        <Field
          label={t.auth.phoneLabel}
          value={raw}
          onChangeText={(next) => {
            setRaw(next);
            setError(null);
          }}
          placeholder={t.auth.phonePlaceholder}
          keyboardType="phone-pad"
          error={error}
          autoFocus
        />
      </View>

      {/* The safety promise sits on the sign-up screen on purpose: it is the
          reason to trust the app, and it should arrive before the phone
          number does, not after. */}
      <Card tone="brand" level="none" style={styles.note}>
        <MaterialCommunityIcons name="shield-check" size={19} color={colors.brandInk} />
        <Text style={[type.small, styles.noteText, { color: colors.brandInk }]}>
          {t.safety.intro}
        </Text>
      </Card>

      <StickyFooter>
        <Button label={t.auth.sendCode} icon="chevron-right" onPress={submit} loading={busy} />
      </StickyFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', paddingTop: space.sm },
  form: { gap: space.lg },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    marginTop: 'auto',
    marginBottom: space.md,
  },
  noteText: { flex: 1 },
});

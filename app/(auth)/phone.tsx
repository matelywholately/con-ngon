import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Screen, ScreenTitle } from '@/components/Screen';
import { useSession } from '@/features/session';
import { useT } from '@/i18n';
import { normalisePhone } from '@/lib/format';
import { space, type, useTheme } from '@/theme';

export default function PhoneScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const router = useRouter();
  const { destination } = useLocalSearchParams<{ destination?: string }>();
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
    router.push({ pathname: '/(auth)/verify', params: { phone,
      ...(destination === 'restaurant' ? { destination: 'restaurant' } : {}) } });
  };

  return (
    <Screen>
      <ScreenTitle title={t.auth.phoneTitle} subtitle={t.auth.phoneBody} />
      <View style={styles.form}>
        <Field
          label={t.auth.phoneLabel}
          value={raw}
          onChangeText={setRaw}
          placeholder={t.auth.phonePlaceholder}
          keyboardType="phone-pad"
          error={error}
          autoFocus
        />
        <Button label={t.auth.sendCode} onPress={submit} loading={busy} />
      </View>
      <Text style={[type.small, styles.note, { color: colors.inkFaint }]}>
        {t.safety.intro}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  note: { marginTop: 'auto', paddingBottom: space.lg },
});

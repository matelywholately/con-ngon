import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { RoundButton } from '@/components/Chip';
import { Field } from '@/components/Field';
import { Screen, ScreenTitle, StickyFooter } from '@/components/Screen';
import { useSession } from '@/features/session';
import { useT } from '@/i18n';
import { space } from '@/theme';

export default function VerifyScreen() {
  const { t, f } = useT();
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { verifyCode, signInWithPhone } = useSession();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const result = await verifyCode(phone ?? '', code);
    setBusy(false);
    if (!result.ok) {
      setError(t.auth.invalidCode);
      return;
    }
    router.replace('/');
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

      <ScreenTitle
        title={t.auth.otpTitle}
        subtitle={f(t.auth.otpBody, { phone: phone ?? '' })}
      />

      <View style={styles.form}>
        <Field
          label={t.auth.otpTitle}
          value={code}
          onChangeText={(next) => {
            setCode(next.replace(/\D/g, ''));
            setError(null);
          }}
          keyboardType="number-pad"
          maxLength={6}
          error={error}
          autoFocus
        />
        <Button
          label={t.auth.resend}
          variant="ghost"
          size="md"
          onPress={() => void signInWithPhone(phone ?? '')}
        />
      </View>

      <StickyFooter>
        <Button
          label={t.auth.verify}
          icon="check-circle"
          onPress={submit}
          loading={busy}
          disabled={code.length < 6}
        />
      </StickyFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', paddingTop: space.sm },
  form: { gap: space.md },
});

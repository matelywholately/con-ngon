import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Screen, ScreenTitle } from '@/components/Screen';
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
          label={t.auth.verify}
          onPress={submit}
          loading={busy}
          disabled={code.length < 6}
        />
        <Button
          label={t.auth.resend}
          variant="ghost"
          onPress={() => void signInWithPhone(phone ?? '')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },
});

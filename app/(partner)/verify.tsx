import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Screen, ScreenTitle } from '@/components/Screen';
import { useSession } from '@/features/session';
import { useT } from '@/i18n';
import { collectOrder } from '@/lib/queries';
import { radius, space, type, useTheme } from '@/theme';

/**
 * Handover at the counter.
 *
 * The keypad is the primary path, not the scanner: staff are behind a
 * counter, the customer is holding a phone at an awkward angle, and reading
 * four digits aloud is faster than lining up a camera. The scanner is there
 * for when it is quicker, not as the happy path.
 */
export default function VerifyPickup() {
  const { colors } = useTheme();
  const { t, f } = useT();
  const { user } = useSession();

  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<
    { kind: 'ok'; name: string } | { kind: 'error'; message: string } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const verify = async (value: string) => {
    if (!user?.restaurantId || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const outcome = await collectOrder(user.restaurantId, value);

      if (outcome.ok) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setResult({ kind: 'ok', name: outcome.order.eater_name ?? '' });
        setCode('');
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setResult({ kind: 'error', message:
          outcome.reason === 'past_pickup_window' ? t.partner.pickupExpired
          : outcome.reason === 'pickup_not_started' ? t.partner.pickupNotStarted
          : outcome.reason === 'restaurant_unavailable' ? t.partner.pickupUnavailable
          : outcome.reason === 'ambiguous_code' ? t.partner.ambiguousCode
          : outcome.reason === 'code_not_found' ? t.partner.wrongCode : t.common.errorBody });
      }
    } catch {
      setResult({ kind: 'error', message: t.common.errorBody });
    } finally {
      inFlight.current = false;
      setBusy(false);
      setScanning(false);
    }
  };

  const startScan = async () => {
    if (!permission?.granted) {
      const next = await requestPermission();
      if (!next.granted) return;
    }
    setResult(null);
    setScanning(true);
  };

  return (
    <Screen edges={['top']}>
      <ScreenTitle title={t.partner.verifyTitle} subtitle={t.partner.enterCode} />

      {scanning ? (
        <View style={styles.scanner}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => void verify(data.slice(-4))}
          />
        </View>
      ) : (
        <View style={styles.form}>
          <Field
            label={t.partner.enterCode}
            value={code}
            onChangeText={(next) => {
              setCode(next.replace(/\D/g, ''));
              setResult(null);
            }}
            keyboardType="number-pad"
            maxLength={4}
            autoFocus
          />

          {result ? (
            <View
              style={[
                styles.result,
                {
                  backgroundColor:
                    result.kind === 'ok' ? colors.brandSoft : colors.dangerSoft,
                },
              ]}
            >
              <Text
                style={[
                  type.heading,
                  { color: result.kind === 'ok' ? colors.brandInk : colors.danger },
                ]}
              >
                {result.kind === 'ok'
                  ? result.name ? f(t.partner.verified, { name: result.name }) : t.partner.verifiedGeneric
                  : result.message}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      <View style={styles.footer}>
        {scanning ? (
          <Button label={t.common.cancel} variant="secondary" onPress={() => setScanning(false)} />
        ) : (
          <>
            <Button
              label={t.partner.verifyTitle}
              onPress={() => void verify(code)}
              disabled={code.length < 4}
              loading={busy}
            />
            <Button label={t.partner.scanInstead} variant="secondary" onPress={startScan} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  scanner: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  result: { padding: space.lg, borderRadius: radius.lg },
  footer: { marginTop: 'auto', gap: space.sm, paddingVertical: space.lg },
});

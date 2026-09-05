import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Screen, ScreenTitle, StickyFooter } from '@/components/Screen';
import { useTabBarClearance } from '@/components/TabBar';
import { useSession } from '@/features/session';
import { useT } from '@/i18n';
import { collectOrder } from '@/lib/queries';
import { overlay, radius, space, type, useTheme } from '@/theme';

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
  const clearance = useTabBarClearance();
  const { user } = useSession();

  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<
    { kind: 'ok'; name: string } | { kind: 'error'; message: string } | null
  >(null);
  const [busy, setBusy] = useState(false);

  const verify = async (value: string) => {
    if (!user?.restaurantId || busy) return;
    setBusy(true);
    const outcome = await collectOrder(user.restaurantId, value);
    setBusy(false);
    setScanning(false);

    if (outcome.ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult({ kind: 'ok', name: outcome.order.eater_name ?? '—' });
      setCode('');
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setResult({ kind: 'error', message: t.partner.wrongCode });
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

  const ok = result?.kind === 'ok';

  return (
    <Screen edges={['top']}>
      <ScreenTitle title={t.partner.verifyTitle} subtitle={t.partner.enterCode} />

      {scanning ? (
        <View style={[styles.scanner, { marginBottom: clearance }]}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => void verify(data.slice(-4))}
          />
          {/* A frame to aim at, rather than a bare camera feed. */}
          <View style={styles.reticle}>
            <View style={[styles.reticleBox, { borderColor: colors.onImage }]} />
          </View>
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
                { backgroundColor: ok ? colors.brandSoft : colors.dangerSoft },
              ]}
            >
              <MaterialCommunityIcons
                name={ok ? 'check-circle' : 'alert-circle-outline'}
                size={26}
                color={ok ? colors.brandInk : colors.danger}
              />
              <Text
                style={[
                  type.heading,
                  styles.resultText,
                  { color: ok ? colors.brandInk : colors.danger },
                ]}
              >
                {result.kind === 'ok'
                  ? f(t.partner.verified, { name: result.name })
                  : result.message}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      <StickyFooter>
        {scanning ? (
          <Button
            label={t.common.cancel}
            variant="secondary"
            onPress={() => setScanning(false)}
          />
        ) : (
          <>
            <Button
              label={t.partner.verifyTitle}
              icon="check-circle"
              onPress={() => void verify(code)}
              disabled={code.length < 4}
              loading={busy}
            />
            <Button
              label={t.partner.scanInstead}
              icon="qrcode-scan"
              variant="secondary"
              onPress={startScan}
            />
          </>
        )}
      </StickyFooter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  scanner: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: overlay.camera,
  },
  reticle: {
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleBox: {
    width: '62%',
    aspectRatio: 1,
    borderWidth: 3,
    borderRadius: radius.lg,
    opacity: 0.85,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
  },
  resultText: { flex: 1 },
});

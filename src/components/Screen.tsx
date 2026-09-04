import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { space, type, useTheme } from '@/theme';

export function Screen({
  children,
  edges = ['top', 'bottom'],
  padded = true,
}: {
  children: ReactNode;
  edges?: readonly Edge[];
  padded?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.root, { backgroundColor: colors.ground }]}
    >
      <View style={[styles.body, padded && styles.padded]}>{children}</View>
    </SafeAreaView>
  );
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Text style={[type.display, { color: colors.ink }]}>{title}</Text>
      {subtitle ? (
        <Text style={[type.body, styles.subtitle, { color: colors.inkMuted }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={[type.title, { color: colors.ink }]}>{title}</Text>
      <Text style={[type.body, styles.emptyBody, { color: colors.inkMuted }]}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  padded: { paddingHorizontal: space.lg },
  header: { paddingTop: space.md, paddingBottom: space.lg, gap: space.xs },
  subtitle: { maxWidth: 420 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
  },
  emptyBody: { textAlign: 'center', maxWidth: 320 },
});

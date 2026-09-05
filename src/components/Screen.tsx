import type { ReactNode } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { radius, space, type, useTheme } from '@/theme';

type Glyph = keyof typeof MaterialCommunityIcons.glyphMap;

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

/**
 * A screen's masthead. The title is set in the display face at a size that
 * would have been absurd on the old scale — it is the only large type on
 * most screens, and it anchors a page whose main content is photography.
 */
export function ScreenTitle({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  /** A control that belongs beside the title, e.g. a language switch. */
  trailing?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Text style={[type.display, styles.headerTitle, { color: colors.ink }]}>
          {title}
        </Text>
        {trailing}
      </View>
      {subtitle ? (
        <Text style={[type.body, styles.subtitle, { color: colors.inkMuted }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** A small heading between blocks. Uppercase, tracked, never competing. */
export function SectionLabel({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <Text style={[type.label, { color: colors.inkFaint }]}>{label.toUpperCase()}</Text>
  );
}

export function EmptyState({
  title,
  body,
  icon = 'food-off-outline',
}: {
  title: string;
  body: string;
  icon?: Glyph;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.brandSoft }]}>
        <MaterialCommunityIcons name={icon} size={30} color={colors.brandInk} />
      </View>
      <Text style={[type.title, styles.emptyTitle, { color: colors.ink }]}>{title}</Text>
      <Text style={[type.body, styles.emptyBody, { color: colors.inkMuted }]}>
        {body}
      </Text>
    </View>
  );
}

/**
 * The bar pinned to the bottom of a scrolling screen. It carries its own
 * ground colour and a hairline so content scrolling underneath does not bleed
 * into the primary action.
 */
export function StickyFooter({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.footer,
        { backgroundColor: colors.ground, borderTopColor: colors.lineSoft },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  padded: { paddingHorizontal: space.lg },
  header: { paddingTop: space.md, paddingBottom: space.lg, gap: space.xs },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  headerTitle: { flexShrink: 1 },
  subtitle: { maxWidth: 420 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  emptyTitle: { textAlign: 'center' },
  emptyBody: { textAlign: 'center', maxWidth: 320 },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
});

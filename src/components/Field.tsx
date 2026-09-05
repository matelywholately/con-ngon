import { StyleSheet, Text, TextInput, View } from 'react-native';
import { HIT_SIZE, radius, space, type, useTheme } from '@/theme';

/**
 * Inputs are recessed rather than outlined — a filled well on the warm ground
 * reads as "type here" without a border competing with the rounded cards
 * around it. The border comes back only to carry an error.
 */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  hint,
  error,
  maxLength,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'phone-pad';
  hint?: string;
  error?: string | null;
  maxLength?: number;
  autoFocus?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[type.label, { color: colors.inkFaint }]}>
        {label.toUpperCase()}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoFocus={autoFocus}
        accessibilityLabel={label}
        style={[
          type.body,
          styles.input,
          {
            backgroundColor: colors.surfaceSunken,
            borderColor: error ? colors.danger : 'transparent',
            color: colors.ink,
          },
        ]}
      />
      {error ? (
        <Text style={[type.small, { color: colors.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[type.small, { color: colors.inkFaint }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

/**
 * A row of pills, one of which is on. Used for portion counts, payment
 * methods and the handling class, which is the most consequential choice in
 * the app — so it is a set of visible options rather than a picker.
 */
export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  const { colors, shadow } = useTheme();
  const activeHint = options.find((o) => o.value === value)?.hint;

  return (
    <View style={styles.wrap}>
      <Text style={[type.label, { color: colors.inkFaint }]}>
        {label.toUpperCase()}
      </Text>
      <View style={styles.choices}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Text
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                type.bodyStrong,
                styles.choice,
                selected ? null : shadow.e1,
                {
                  backgroundColor: selected ? colors.brand : colors.surface,
                  color: selected ? colors.onBrand : colors.ink,
                },
              ]}
            >
              {option.label}
            </Text>
          );
        })}
      </View>
      {activeHint ? (
        <Text style={[type.small, { color: colors.inkFaint }]}>{activeHint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: space.lg,
    outlineWidth: 0,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  choice: {
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    overflow: 'hidden',
    minHeight: HIT_SIZE - 8,
  },
});

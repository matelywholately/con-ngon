import { StyleSheet, Text, TextInput, View } from 'react-native';
import { HIT_SIZE, radius, space, type, useTheme } from '@/theme';

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
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.line,
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

export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: readonly { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
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
              onPress={disabled ? undefined : () => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              style={[
                type.bodyStrong,
                styles.choice,
                {
                  backgroundColor: selected ? colors.brand : colors.surface,
                  borderColor: selected ? colors.brand : colors.line,
                  color: selected ? colors.onBrand : colors.ink,
                },
              ]}
            >
              {option.label}
            </Text>
          );
        })}
      </View>
      {options.find((o) => o.value === value)?.hint ? (
        <Text style={[type.small, { color: colors.inkFaint }]}>
          {options.find((o) => o.value === value)?.hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  input: {
    minHeight: HIT_SIZE,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.md,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  choice: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    overflow: 'hidden',
  },
});

import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Switch, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useAppTheme } from '../theme/theme';
import { fonts, radius, space, typeScale, type ThemeColors } from '../theme/tokens';
import { t } from '../lib/i18n';

type Variant = keyof typeof typeScale;
type Weight = keyof typeof fonts;

export function Txt({ variant = 'body', weight = 'regular', color, tabular, style, ...rest }: TextProps & { variant?: Variant; weight?: Weight; color?: keyof ThemeColors; tabular?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <Text
      {...rest}
      style={[{ ...typeScale[variant], fontFamily: fonts[weight], color: colors[color ?? 'text'] }, tabular ? { fontVariant: ['tabular-nums'] } : null, style]}
    />
  );
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  kind = 'primary',
  loading,
  disabled,
  icon: Icon,
  style,
  accessibilityLabel,
  compact,
}: {
  title: string;
  onPress?: PressableProps['onPress'];
  kind?: ButtonKind;
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  compact?: boolean;
}) {
  const { colors } = useAppTheme();
  const bg = kind === 'primary' ? colors.primary : kind === 'danger' ? colors.danger : 'transparent';
  const fg = kind === 'primary' ? colors.primaryContrast : kind === 'danger' ? colors.primaryContrast : kind === 'ghost' ? colors.link : colors.text;
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: compact ? 36 : 48,
          paddingHorizontal: space(compact ? 1.5 : 2),
          borderRadius: radius.button,
          backgroundColor: bg,
          borderWidth: kind === 'secondary' ? 1 : 0,
          borderColor: colors.borderStrong,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space(1),
          opacity: inactive ? 0.55 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : Icon ? <Icon size={18} color={fg} strokeWidth={1.5} strokeLinecap="square" /> : null}
      <Txt weight="medium" style={{ color: fg }} variant={compact ? 'small' : 'body'}>
        {title}
      </Txt>
    </Pressable>
  );
}

export function IconButton({ icon: Icon, label, onPress, active, size = 22 }: { icon: LucideIcon; label: string; onPress?: () => void; active?: boolean; size?: number }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.button, opacity: pressed ? 0.7 : 1 })}
    >
      <Icon size={size} color={active ? colors.accent : colors.text} fill={active ? colors.accent : 'transparent'} strokeWidth={1.5} strokeLinecap="square" />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, style }: { label: string; selected?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[
        {
          minHeight: 36,
          paddingHorizontal: space(1.5),
          borderRadius: 18,
          borderWidth: 1,
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primary : colors.surface,
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Txt variant="small" weight="medium" style={{ color: selected ? colors.primaryContrast : colors.text }}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Field({ label, error, style, inputStyle, ...rest }: TextInputProps & { label: string; error?: string | null; inputStyle?: StyleProp<TextStyle> }) {
  const { colors } = useAppTheme();
  return (
    <View style={[{ gap: space(0.5) }, style as StyleProp<ViewStyle>]}>
      <Txt variant="small" weight="medium" color="textMuted">
        {label}
      </Txt>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        {...rest}
        style={[
          {
            minHeight: 48,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            borderRadius: radius.button,
            paddingHorizontal: space(1.5),
            paddingVertical: space(1),
            backgroundColor: colors.surface,
            color: colors.text,
            fontFamily: fonts.regular,
            fontSize: 16,
          },
          inputStyle,
        ]}
      />
      {error ? (
        <Txt variant="small" color="danger">
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

export function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, gap: space(2) }}>
      <Txt style={{ flex: 1 }}>{label}</Txt>
      <Switch accessibilityLabel={label} value={value} onValueChange={onValueChange} trackColor={{ true: colors.primary, false: colors.surface2 }} thumbColor={colors.surface} />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();
  return <View style={[{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space(2) }, style]}>{children}</View>;
}

export function Section({ title, children, style }: { title: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: space(1) }, style]}>
      <Txt variant="h3" weight="semibold" accessibilityRole="header">
        {title}
      </Txt>
      {children}
    </View>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'accent' | 'success' | 'danger' }) {
  const { colors } = useAppTheme();
  const bg = tone === 'accent' ? colors.accent : tone === 'success' ? colors.success : tone === 'danger' ? colors.danger : colors.surface2;
  const fg = tone === 'accent' ? colors.accentContrast : tone === 'neutral' ? colors.text : colors.primaryContrast;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <Txt variant="small" weight="medium" style={{ color: fg }}>
        {label}
      </Txt>
    </View>
  );
}

export function EmptyState({ icon: Icon, title, hint, action }: { icon?: LucideIcon; title: string; hint?: string; action?: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ alignItems: 'center', padding: space(4), gap: space(1.5) }}>
      {Icon ? <Icon size={40} color={colors.borderStrong} strokeWidth={1.5} strokeLinecap="square" /> : null}
      <Txt variant="h3" weight="semibold" style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      {hint ? (
        <Txt color="textMuted" style={{ textAlign: 'center' }}>
          {hint}
        </Txt>
      ) : null}
      {action}
    </View>
  );
}

export function Loading() {
  const { colors } = useAppTheme();
  return (
    <View style={{ padding: space(4), alignItems: 'center' }} accessibilityLabel={t('common.loading')}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ margin: space(2), padding: space(2), borderRadius: radius.card, borderWidth: 1, borderColor: colors.danger, gap: space(1) }} accessibilityRole="alert">
      <Txt color="danger">{message}</Txt>
      {onRetry ? <Button kind="secondary" compact title={t('common.retry')} onPress={onRetry} /> : null}
    </View>
  );
}

export function Divider() {
  const { colors } = useAppTheme();
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

import Svg, { Circle, Path } from 'react-native-svg';
import { useAppTheme } from '../theme/theme';

/** Brand mark (packages/ui/src/brand): a location pin set into the corner of a floor plan. Min 20 px. */
export function LogoMark({ size = 28 }: { size?: number }) {
  const { colors } = useAppTheme();
  const s = Math.max(20, size);
  return (
    <Svg width={s} height={s} viewBox="0 0 32 32" fill="none" accessibilityLabel="lokacia.ge">
      <Path d="M5 27V9" stroke={colors.primary} strokeWidth={2.6} strokeLinecap="square" />
      <Path d="M5 27H23" stroke={colors.primary} strokeWidth={2.6} strokeLinecap="square" />
      <Circle cx={21} cy={11} r={4.2} fill={colors.sulfur} />
    </Svg>
  );
}

import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { formatNumber } from '@lokacia/contracts';
import { spacePlanGeometry, type SpacePlanInput } from '../lib/space-plan';
import { t } from '../lib/i18n';
import { useAppTheme } from '../theme/theme';
import { fonts } from '../theme/tokens';

/** Signature component: the space outline drawn like a floor plan with dimension lines (BRAND.md). */
export function SpacePlan({ ceilingM, powerKw, ...input }: SpacePlanInput & { ceilingM?: number | null; powerKw?: number | null }) {
  const { colors } = useAppTheme();
  const g = spacePlanGeometry(input);
  const label = t('listing.planLabel', { w: formatNumber(g.widthM, 1), d: formatNumber(g.depthM, 1), area: formatNumber(input.areaM2) });
  const tick = 5;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: '100%', maxWidth: 560, alignSelf: 'center', aspectRatio: g.viewBox.w / g.viewBox.h }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${g.viewBox.w} ${g.viewBox.h}`}>
        <G opacity={0.35}>
          {g.grid.vertical.map((x) => (
            <Line key={`v${x}`} x1={x} y1={0} x2={x} y2={g.viewBox.h} stroke={colors.border} strokeWidth={0.6} />
          ))}
          {g.grid.horizontal.map((y) => (
            <Line key={`h${y}`} x1={0} y1={y} x2={g.viewBox.w} y2={y} stroke={colors.border} strokeWidth={0.6} />
          ))}
        </G>
        <Path d={g.path} fill={colors.surface} stroke={colors.text} strokeWidth={input.compact ? 2.5 : 3} strokeLinejoin="miter" />
        <G stroke={colors.link} strokeWidth={1}>
          <Line x1={g.widthDim.x1} y1={g.widthDim.y} x2={g.widthDim.x2} y2={g.widthDim.y} />
          <Line x1={g.widthDim.x1} y1={g.widthDim.y - tick} x2={g.widthDim.x1} y2={g.widthDim.y + tick} />
          <Line x1={g.widthDim.x2} y1={g.widthDim.y - tick} x2={g.widthDim.x2} y2={g.widthDim.y + tick} />
          <Line x1={g.depthDim.x} y1={g.depthDim.y1} x2={g.depthDim.x} y2={g.depthDim.y2} />
          <Line x1={g.depthDim.x - tick} y1={g.depthDim.y1} x2={g.depthDim.x + tick} y2={g.depthDim.y1} />
          <Line x1={g.depthDim.x - tick} y1={g.depthDim.y2} x2={g.depthDim.x + tick} y2={g.depthDim.y2} />
        </G>
        <SvgText x={g.widthDim.labelX} y={g.widthDim.labelY} textAnchor="middle" fontSize={11} fill={colors.link} fontFamily={fonts.regular}>
          {`${formatNumber(g.widthM, 1)} მ`}
        </SvgText>
        <SvgText
          x={g.depthDim.labelX}
          y={g.depthDim.labelY}
          textAnchor="middle"
          fontSize={11}
          fill={colors.link}
          fontFamily={fonts.regular}
          transform={`rotate(-90 ${g.depthDim.labelX} ${g.depthDim.labelY})`}
        >
          {`${formatNumber(g.depthM, 1)} მ`}
        </SvgText>
        <SvgText x={g.rect.x + g.rect.w / 2} y={g.rect.y + g.rect.h / 2 + 7} textAnchor="middle" fontSize={input.compact ? 20 : 24} fontFamily={fonts.semibold} fill={colors.text}>
          {`${formatNumber(input.areaM2)} მ²`}
        </SvgText>
        <Line x1={g.door.x} y1={g.door.y} x2={g.door.x + g.door.r} y2={g.door.y} stroke={colors.surface} strokeWidth={4} />
        <Path d={`M${g.door.x} ${g.door.y} a${g.door.r} ${g.door.r} 0 0 0 ${g.door.r} ${-g.door.r}`} fill="none" stroke={colors.borderStrong} strokeWidth={1} />
        <Circle cx={g.pin.cx} cy={g.pin.cy} r={4} fill={colors.sulfur} />
        {!input.compact && ceilingM ? (
          <SvgText x={44} y={g.footerY} fontSize={11} fill={colors.textMuted} fontFamily={fonts.regular}>
            {`↕ ${t('listing.ceiling', { v: formatNumber(ceilingM, 1) })}`}
          </SvgText>
        ) : null}
        {!input.compact && powerKw ? (
          <SvgText x={g.viewBox.w - 28} y={g.footerY} textAnchor="end" fontSize={11} fill={colors.textMuted} fontFamily={fonts.regular}>
            {`⚡ ${t('listing.power', { v: formatNumber(powerKw) })}`}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}

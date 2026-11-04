import { StyleSheet, View } from 'react-native';
import Svg, { Defs, G, Line, Pattern, Rect } from 'react-native-svg';
import type { Overview } from '@app/contracts';
import { fraction, maxOf, scale, signedValue, TERMS } from '@app/view';
import { texts } from '../../texts.ts';
import { theme } from '../../theme/index.ts';
import { colors, compactChange, flowColors, format } from '../../view.ts';
import { screenStyles } from '../../ui/Screen.tsx';
import { Text } from '../../ui/Text.tsx';

export const waterfallHeight = 120;

export function Waterfall({ day }: { day: Overview['day'] }) {
  const total = day?.rows.find((row) => row.scope === 'all');
  const values = TERMS.map((term) => signedValue(term, total?.values[term] ?? null));
  const labels = values.map((value) => compactChange(value));
  const scaled = scale(values).values;
  const known = scaled.every((value) => value !== null);
  // Accumulate only plot positions. Net and every label use their own published values.
  let position = 0n;
  const edges: [bigint, bigint][] = [];
  for (const [index, value] of scaled.entries()) {
    const start = TERMS[index] === 'net' ? 0n : position;
    position = start + (value ?? 0n);
    edges.push([start, position]);
  }
  const extent = maxOf(edges.flat().map((value) => value < 0n ? -value : value)) || 1n;
  const y = (value: bigint) => 60 - fraction(value, 0n, extent) * 50;
  return <View style={styles.block}>
    {known && <Svg width="100%" height={waterfallHeight} viewBox="0 0 500 120" preserveAspectRatio="none"
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>{(['bridge_in', 'bridge_out'] as const).map((flow) => <Pattern key={flow} id={flow} width={5} height={5}
        patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <Rect width={1.8} height={5} fill={flowColors[flow]} />
      </Pattern>)}</Defs>
      <Line x1={0} x2={500} y1={60} y2={60} stroke={colors['color-zero-line']} />
      {TERMS.map((term, index) => {
        const [start, end] = edges[index];
        const fill = term.startsWith('bridge') ? `url(#${term})` : flowColors[term];
        return <G key={term}>
          {term !== 'net' && <Line x1={index * 100 + 75} x2={(index + 1) * 100 + 25} y1={y(end)} y2={y(end)}
            stroke={colors['color-zero-line']} strokeDasharray="3 3" />}
          <Rect x={index * 100 + 25} y={Math.min(y(start), y(end))} width={50} height={Math.max(1, Math.abs(y(start) - y(end)))}
            fill={fill} stroke={term === 'net' && total?.unreconciled ? colors['color-unreconciled'] : undefined} />
        </G>;
      })}
    </Svg>}
    <View style={styles.labels}>{TERMS.map((term, index) => <View key={term} style={styles.term}>
      <Text testID={`waterfall.${term}`} family="mono" variant="xs" style={{ color: flowColors[term] }}>{labels[index]}</Text>
      <Text variant="xs" style={screenStyles.dim}>{texts.flows[term]}</Text>
    </View>)}</View>
    <Text variant="xs" family="mono" style={screenStyles.dim}>
      {day ? `/// ${format.formatShortDay(day.date)} · all tracked chains` : texts.noData}
      {total?.unreconciled ? ` · ◇ ${texts.tags.unreconciledDay}` : ''}
    </Text>
  </View>;
}

const styles = StyleSheet.create({
  block: { gap: theme.spacing[1], marginTop: theme.spacing[2] },
  labels: { flexDirection: 'row' },
  term: { flex: 1, alignItems: 'center' },
});

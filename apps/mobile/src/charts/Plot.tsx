import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Canvas, Line, Path } from '@shopify/react-native-skia';
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import type { Series } from '@app/contracts';
import { columnWidth, columnX, plotHeight } from '@app/view';
import type { Frame, TooltipColumn } from '@app/view';
import { theme } from '../theme/index.ts';
import { texts } from '../texts.ts';
import { colors, flowColors, format } from '../view.ts';
import { Dot, screenStyles } from '../ui/Screen.tsx';
import { Text } from '../ui/Text.tsx';

const height = 220;
const cardWidth = 240;
const { spacing, dimensions } = theme;

export type PlotContent = { marks: ReactNode; grid: { y: number; label: string }[]; tooltips: TooltipColumn[] };

export function Plot({ series, id, label, build }: {
  series: Series; id: string; label: string; build: (frame: Frame) => PlotContent;
}) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const columns = series.buckets.length;
  const frame = useMemo(() => ({ width, height, left: 0, top: 14, right: 46, bottom: 24, columns }), [width, columns]);
  const select = (x: number) => {
    if (frame.columns > 0 && width > frame.left + frame.right) {
      setSelected(Math.min(frame.columns - 1, Math.max(0, Math.floor((x - frame.left) / columnWidth(frame)))));
    }
  };
  const tap = useTapGesture({ runOnJS: true, onDeactivate: ({ x, canceled }) => { if (!canceled) select(x); } });
  const pan = usePanGesture({ runOnJS: true, activeOffsetX: [-5, 5], failOffsetY: [-8, 8],
    onActivate: ({ x }) => select(x), onUpdate: ({ x }) => select(x) });
  const gesture = useCompetingGestures(pan, tap);
  const plot = useMemo(() => width > frame.left + frame.right && frame.columns > 0 ? build(frame) : null, [build, frame, width]);
  const tip = selected === null ? undefined : plot?.tooltips[selected];
  const x = selected === null ? 0 : columnX(frame, selected);
  const tickIndices = columns === 0 ? [] : [...new Set([0, 1 / 3, 2 / 3, 1].map((position) => Math.round(position * (columns - 1))))];
  const days = tickIndices.map((index) => series.buckets[index].end);
  const dates = series.period === 'month' ? days.map((day) => `${texts.months[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`)
    : format.formatDays(days);
  const tickStep = Math.min(Math.max(1, columns), ...tickIndices.slice(1).map((index, position) => index - tickIndices[position]));
  const labelWidth = Math.max(0, Math.min(78, columnWidth(frame) * tickStep - spacing[1]));
  const pinnedWidth = Math.min(cardWidth, width);
  const tipLeft = x >= width / 2 ? 0 : width - pinnedWidth;
  if (columns === 0) return <Text style={screenStyles.label}>{texts.noData}</Text>;
  return <View onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)} style={styles.plot}>
    {plot && <GestureDetector gesture={gesture}>
      <View testID={id} accessible accessibilityRole="adjustable" accessibilityLabel={label}
        accessibilityValue={tip ? { text: tip.footer.label } : undefined}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'activate', label: 'Show latest bucket' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === 'activate') setSelected(frame.columns - 1);
          else if (nativeEvent.actionName === 'increment') setSelected(Math.min(frame.columns - 1, (selected ?? -1) + 1));
          else if (nativeEvent.actionName === 'decrement') setSelected(Math.max(0, (selected ?? frame.columns) - 1));
        }} style={StyleSheet.absoluteFill}>
        <Canvas style={StyleSheet.absoluteFill}>
          {plot.grid.map(({ y, label }) => <Line key={y} p1={{ x: frame.left, y }} p2={{ x: width - frame.right, y }}
            color={colors[label === '0' ? 'color-zero-line' : 'color-hairline']} strokeWidth={1} />)}
          {plot.marks}
          {tip && <Path path={Array.from({ length: Math.ceil(plotHeight(frame) / 6) }, (_, index) => {
            const y = frame.top + index * 6;
            return `M${x} ${y}v3`;
          }).join('')} color={colors['color-crosshair']} style="stroke" strokeWidth={1} />}
        </Canvas>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {plot.grid.map(({ y, label }) => <Text key={y} family="mono" variant="xs" numberOfLines={1} maxFontSizeMultiplier={1.15} adjustsFontSizeToFit
            style={[styles.tick, { top: y - 7, width: frame.right - spacing[1] }]}>{label}</Text>)}
          {tickIndices.map((index, position) => {
            const tickX = columnX(frame, index);
            return <Text key={index} family="mono" variant="xs" numberOfLines={1} maxFontSizeMultiplier={1.15} adjustsFontSizeToFit
              style={[styles.date, { left: Math.min(width - labelWidth, Math.max(0, tickX - labelWidth / 2)), width: labelWidth }]}>
              {dates[position]}
            </Text>;
          })}
        </View>
      </View>
    </GestureDetector>}
    {tip && <View testID={`${id}.tooltip`} style={[styles.card, { left: tipLeft, width: pinnedWidth }]}>
      <ScrollView nestedScrollEnabled contentContainerStyle={styles.tipBody}>
        <Text family="mono" variant="xs" accessibilityLiveRegion="polite" style={styles.cardHeading}>{tip.footer.label}</Text>
        {!tip.hideHeader && <Text family="mono" variant="xs">{tip.header.label} · {tip.header.value}{tip.header.share ? ` · ${tip.header.share}` : ''}</Text>}
        {tip.rows.map((row, index) => <View key={`${index}:${row.label}`}
          style={[styles.tipRow, index === tip.splitBefore && styles.tipSplit]}>
          <Dot color={row.flow && Object.hasOwn(flowColors, row.flow) ? flowColors[row.flow as keyof typeof flowColors]
            : theme.chains[(row.chain ?? 0) - 1] ?? colors['color-text-muted']} size={6} />
          <Text variant="xs" numberOfLines={1} style={screenStyles.grow}>{row.label}</Text>
          <Text family="mono" variant="xs">{row.value}{row.share ? ` · ${row.share}` : ''}</Text>
        </View>)}
        {tip.note && <Text variant="xs" style={{ color: colors[`color-${tip.note.tone}`] }}>{tip.note.text}</Text>}
        <Text variant="xs" style={screenStyles.dim}>{tip.footer.value}</Text>
      </ScrollView>
      <Pressable testID={`${id}.dismiss`} accessibilityRole="button" accessibilityLabel={texts.close}
        onPress={() => setSelected(null)} style={styles.close}><Text>×</Text></Pressable>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  plot: { height },
  tick: { position: 'absolute', right: 0, color: colors['color-text-dim'], textAlign: 'right' },
  date: { position: 'absolute', bottom: 0, textAlign: 'center', color: colors['color-text-dim'] },
  card: { position: 'absolute', top: 0, maxHeight: height, borderWidth: StyleSheet.hairlineWidth, borderColor: colors['color-border'],
    borderRadius: theme.radii.tooltip, backgroundColor: colors['color-tooltip-bg'], overflow: 'hidden' },
  tipBody: { gap: 2, padding: spacing[2] },
  cardHeading: { minHeight: 18, marginRight: dimensions['touch-target'], color: colors['color-text-muted'] },
  close: { position: 'absolute', top: 0, right: 0, width: dimensions['touch-target'], height: dimensions['touch-target'],
    alignItems: 'center', justifyContent: 'center' },
  tipRow: { ...screenStyles.row, gap: spacing[1] },
  tipSplit: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors['color-hairline'], paddingTop: spacing[1] },
});

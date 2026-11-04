import { Pressable, StyleSheet, View } from 'react-native';
import { Group, Path, Skia } from '@shopify/react-native-skia';
import type { Overview, OverviewView } from '@app/contracts';
import {
  chainInfo, columnX, driverColumns, driverDigits, driverExtent, fractionY, linePath,
  niceCeil, symmetricFraction, unscale,
} from '@app/view';
import { theme } from '../theme/index.ts';
import { texts } from '../texts.ts';
import { chainColor, colors, flowColors, format, seriesText, tooltip } from '../view.ts';
import { Dot, screenStyles } from '../ui/Screen.tsx';
import { Text } from '../ui/Text.tsx';
import { bandPath } from './geometry.ts';
import { Plot } from './Plot.tsx';

const { spacing, dimensions } = theme;

export function Flows({ overview, view, scope, onScope, id }: {
  overview: Overview; view: OverviewView; scope: string; onScope?: (scope: string) => void; id: string;
}) {
  const driver = view.drivers.find((item) => item.scope === scope);
  const split = view.issuerVsBridge.find((item) => item.scope === scope);
  const issuerShare = (side: 'in' | 'out') => {
    if (!split) return '';
    const { volume, quality } = split[side];
    return volume.issuerShare === null ? seriesText.naReason('volume', side, quality)
      : `Issuer ${format.formatPercent(volume.issuerShare, { places: 0 })} of ${side === 'in' ? 'inflow' : 'outflow'}`;
  };
  const name = scope === 'all' ? texts.drivers.allChains : chainInfo(overview.chains, scope).name;
  const options = [{ slug: 'all', name: 'All' }, ...overview.chains];
  return <View style={styles.block}>
    <Text accessibilityRole="header">{texts.flowsTitle} <Text variant="sm" style={screenStyles.label}>· {format.formatRange(view.from, view.to)}</Text></Text>
    {split && <Text variant="xs" style={screenStyles.label}>{[...new Set([issuerShare('in'), issuerShare('out')])].join(' · ')}</Text>}
    {onScope && <View style={styles.chips}>
      {options.map((item) => <Pressable key={item.slug} testID={`${id}.scope.${item.slug}`} accessibilityRole="button"
        accessibilityState={{ selected: scope === item.slug }} style={[styles.chip, scope === item.slug && styles.selected]}
        onPress={() => onScope(item.slug)}>
        {item.slug !== 'all' && <Dot color={chainColor(overview.chains, item.slug)} size={6} />}
        <Text variant="xs" style={scope === item.slug ? styles.accent : screenStyles.label}>{item.name}</Text>
      </Pressable>)}
    </View>}
    {driver ? <DriverPlot key={`${view.period}:${scope}`} driver={driver} id={`${id}.chart`} name={name} />
      : <Text style={screenStyles.label}>{texts.noData}</Text>}
  </View>;
}

function DriverPlot({ driver, id, name }: { driver: OverviewView['drivers'][number]; id: string; name: string }) {
  const { series, events } = driver;
  const digits = driverDigits(series);
  const columns = driverColumns(series, digits, events);
  const max = niceCeil(driverExtent(columns));
  return <Plot id={id} label={`${texts.flowsTitle} · ${name}`} series={series} build={(frame) => {
    const y = (value: bigint) => fractionY(frame, symmetricFraction(value, max));
    const zero = () => y(0n);
    const { values } = columns;
    const valid = (index: number) => columns.known[index] === true;
    const lines = linePath(values.net.map((value, index) => valid(index) && value !== null ? { x: columnX(frame, index), y: y(value) } : null));
    const hatch = Array.from({ length: Math.ceil((frame.width + frame.height) / 6) }, (_, index) =>
      `M${index * 6} 0l-${frame.height} ${frame.height}`).join('');
    const bands = [
      { flow: 'issuer_mint', edge: (index: number) => y(values.issuer_mint[index] ?? 0n), base: zero },
      { flow: 'issuer_burn', edge: (index: number) => y(-(values.issuer_burn[index] ?? 0n)), base: zero },
      { flow: 'bridge_in', edge: (index: number) => y(columns.up[index] ?? 0n), base: (index: number) => y(values.issuer_mint[index] ?? 0n) },
      { flow: 'bridge_out', edge: (index: number) => y(-(columns.down[index] ?? 0n)), base: (index: number) => y(-(values.issuer_burn[index] ?? 0n)) },
    ] as const;
    const ticks = [...new Set(max > 0n ? [max, max / 2n, 0n, -max / 2n, -max] : [0n])];
    return {
      grid: ticks.map((value) => ({ y: y(value), label: seriesText.axisSigned(unscale(value, digits)) })),
      marks: <>
        {bands.map(({ flow, edge, base }) => {
          const path = bandPath(frame, valid, edge, base);
          if (!path) return null;
          const clip = flow.startsWith('bridge') ? Skia.Path.MakeFromSVGString(path) : null;
          return <Group key={flow}>
            <Path path={path} color={flowColors[flow]} opacity={clip ? 0.2 : 0.62} />
            {clip && <Group clip={clip}><Path path={hatch} color={flowColors[flow]} style="stroke" strokeWidth={1} /></Group>}
          </Group>;
        })}
        {lines && <Path path={lines} color={flowColors.net} style="stroke" strokeWidth={1.5} />}
        {columns.unreconciled.map((index) => {
          const net = values.net[index];
          if (net == null) return null;
          const x = columnX(frame, index);
          return <Path key={index} path={`M${x} ${y(net) - 4}l4 4l-4 4l-4 -4z`}
            color={colors['color-unreconciled']} style="stroke" strokeWidth={1.5} />;
        })}
      </>,
      tooltips: tooltip.driverTooltips(series, digits, name, events),
    };
  }} />;
}

const styles = StyleSheet.create({
  block: { marginTop: spacing[3], gap: spacing[1] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] },
  chip: { ...screenStyles.row, gap: spacing[1], minHeight: dimensions['touch-target'], paddingHorizontal: spacing[2],
    borderRadius: theme.radii.chip, borderWidth: StyleSheet.hairlineWidth, borderColor: colors['color-hairline'] },
  selected: { borderColor: colors['color-border'], backgroundColor: colors['color-surface-2'] },
  accent: { color: colors['color-accent'] },
});

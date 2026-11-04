import { useState } from 'react';
import type { ReactElement } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { Overview, OverviewView } from '@app/contracts';
import type { PeriodId } from '@app/view';
import { isPartialBucket } from '@app/view';
import { Flows } from '../../charts/Flows.tsx';
import { SupplyChart } from '../../charts/SupplyChart.tsx';
import { theme } from '../../theme/index.ts';
import { texts } from '../../texts.ts';
import { colors, compactChange, equation, format, netColor, seriesText } from '../../view.ts';
import { availablePeriod, Periods } from '../../ui/Periods.tsx';
import { Screen, SectionLabel, Skeleton, screenStyles } from '../../ui/Screen.tsx';
import { Text } from '../../ui/Text.tsx';

const rowHeight = theme.dimensions['row-height-ledger'];
const flows = [['issuer_mint', 'mint'], ['issuer_burn', 'burn'], ['bridge_in', 'in'], ['bridge_out', 'out']] as const;

export default function HistoryScreen() {
  return <Screen title={texts.history} loading={<Skeleton style={{ height: 220 }} />}>
    {(overview, refresh) => <History overview={overview} refresh={refresh} />}
  </Screen>;
}

function History({ overview, refresh }: { overview: Overview; refresh: ReactElement }) {
  const [preferred, setPeriod] = useState<PeriodId>('30d');
  const [preferredScope, setScope] = useState('all');
  const period = availablePeriod(overview, preferred);
  const view = overview.views[period];
  const scope = overview.chains.some((chain) => chain.slug === preferredScope) ? preferredScope : 'all';
  const total = view?.drivers.find((driver) => driver.scope === 'all');
  const series = total?.series;
  const rows = series?.buckets.map((bucket, index) => ({ bucket, index })).reverse() ?? [];
  return <FlatList data={rows} keyExtractor={({ bucket }) => bucket.start} refreshControl={refresh}
    contentContainerStyle={screenStyles.content}
    ListHeaderComponent={<>
      <Periods overview={overview} period={period} onChange={setPeriod} id="history.period" />
      {view && <>
        <Text style={screenStyles.section}>{equation.assetName(overview)}</Text>
        <SupplyChart key={period} overview={overview} view={view} />
        <Flows overview={overview} view={view} scope={scope} onScope={setScope} id="history.flows" />
        <SectionLabel title={`By ${view.period} · all chains`} aside={texts.flows.net} />
      </>}
    </>}
    ListEmptyComponent={<Text style={screenStyles.label}>{texts.noData}</Text>}
    renderItem={({ item }) => view && series ? <LedgerRow series={series} item={item} period={view.period} /> : null} />;
}

type DriverSeries = OverviewView['drivers'][number]['series'];

function LedgerRow({ series, item: { bucket, index }, period }: {
  series: DriverSeries; item: { bucket: DriverSeries['buckets'][number]; index: number }; period: OverviewView['period'];
}) {
  const value = (key: string) => {
    const found = series.lines.find((line) => line.flow === key)?.values[index];
    return found == null ? null : String(found);
  };
  const net = value('net');
  const amounts = flows.map(([key, label]) => ({ label, amount: value(key) }));
  const flagged = series.lines.some((line) => line.unreconciled.includes(index));
  const partial = isPartialBucket(bucket, period);
  const date = period === 'month' && !partial ? `${texts.months[Number(bucket.end.slice(5, 7)) - 1]} ${bucket.end.slice(0, 4)}`
    : seriesText.bucketLabel(bucket);
  return <View testID={`history.ledger.${bucket.start}`} style={[screenStyles.row, screenStyles.divider, styles.ledger]}>
    <View style={screenStyles.grow}>
      <Text variant="sm">{date}{flagged && <Text variant="sm" accessibilityLabel={texts.tags.unreconciledDay}
        style={styles.flag}> ◇</Text>}{partial && <Text variant="xs" style={screenStyles.dim}> · partial</Text>}</Text>
      <Text family="mono" variant="xs" style={screenStyles.label}>
        {amounts.every(({ amount }) => amount === null) ? texts.noData
          : amounts.map(({ label, amount }) => `${label} ${format.formatCompact(amount, { places: 0 })}`).join(' · ')}
      </Text>
    </View>
    <Text family="mono" variant="full" style={{ color: netColor(net) }}>{compactChange(net)}</Text>
  </View>;
}

const styles = StyleSheet.create({
  ledger: { minHeight: rowHeight, paddingVertical: theme.spacing[1] },
  flag: { color: colors['color-unreconciled'] },
});

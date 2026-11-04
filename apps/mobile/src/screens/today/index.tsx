import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { ReactElement } from 'react';
import { useRouter } from 'expo-router';
import type { Overview } from '@app/contracts';
import { chainDay } from '@app/view';
import { theme } from '../../theme/index.ts';
import { texts } from '../../texts.ts';
import { chainColor, chainFigures, colors, compactChange, format, netColor } from '../../view.ts';
import { Dot, Screen, SectionLabel, Skeleton, screenStyles } from '../../ui/Screen.tsx';
import { statusColor } from '../../ui/Status.tsx';
import { Text } from '../../ui/Text.tsx';
import { Waterfall, waterfallHeight } from './Waterfall.tsx';

const { dimensions, spacing } = theme;
export default function TodayScreen() {
  const { fontScale } = useWindowDimensions();
  const rowHeight = Math.round(dimensions['row-height-chain'] * Math.max(1, fontScale));
  return <Screen title={texts.today} loading={<TodaySkeleton rowHeight={rowHeight} />}>
    {(overview, refresh) => <Today overview={overview} refresh={refresh} rowHeight={rowHeight} />}
  </Screen>;
}

function TodaySkeleton({ rowHeight }: { rowHeight: number }) {
  return <View accessibilityLabel="Loading overview" style={styles.skeleton}>
    <Skeleton style={{ width: '55%', height: theme.typeScale.hero }} />
    <Skeleton style={{ width: '65%', height: theme.typeScale.sm }} />
    <Skeleton style={{ width: '60%', height: dimensions['touch-target'] }} />
    <Skeleton style={{ height: waterfallHeight + spacing[4] * 2 }} />
    {[0, 1, 2].map((row) => <Skeleton key={row} style={{ height: rowHeight }} />)}
  </View>;
}

function Today({ overview, refresh, rowHeight }: { overview: Overview; refresh: ReactElement; rowHeight: number }) {
  const router = useRouter();
  const [headerHeight, setHeaderHeight] = useState(0);
  const asOf = overview.asOf;
  const count = overview.reconciliation.reconciledChains;
  const allReconciled = count === overview.chains.length;
  const supply = overview.header.supply.value;
  const status = asOf ? `${allReconciled ? 'reconciled' : `${count}/${overview.chains.length} reconciled`} · ${format.formatDay(asOf)}` : texts.noData;
  return <FlatList data={overview.chains} keyExtractor={(chain) => chain.slug}
    contentContainerStyle={screenStyles.content} refreshControl={refresh}
    getItemLayout={(_, index) => ({ index, length: rowHeight, offset: headerHeight + rowHeight * index })}
    ListHeaderComponent={<View onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
      <Text testID="today.supply" family="mono" variant="hero" numberOfLines={1} adjustsFontSizeToFit
        accessibilityLabel={`${texts.header.cards.supply}: ${format.formatAmount(supply)}`}
        style={styles.figure}>{format.formatCompact(supply)}</Text>
      <Text family="mono" variant="sm" style={styles.delta}>
        <Text testID="today.delta-day" family="mono" variant="sm" style={{ color: netColor(overview.header.change1d.value) }}>
          {compactChange(overview.header.change1d.value)} today
        </Text>
        {' · '}
        <Text testID="today.delta-week" family="mono" variant="sm" style={{ color: netColor(overview.header.change7d.value) }}>
          {compactChange(overview.header.change7d.value)} 7d
        </Text>
      </Text>
      <Pressable testID="today.data" accessibilityRole="button" accessibilityLabel={`${status}. ${texts.howWeCount}`}
        onPress={() => router.push('/data')} style={[screenStyles.row, styles.status]}>
        <View style={styles.dots}>{overview.chains.map((chain) => <Dot key={chain.slug}
          color={statusColor(overview.status.chains.find((item) => item.chain === chain.slug)?.state)} size={6} />)}</View>
        <Text variant="sm" style={[screenStyles.grow, screenStyles.label]}>{allReconciled ? '✓ ' : ''}{status}</Text>
        <Text style={screenStyles.dim}>›</Text>
      </Pressable>
      <Waterfall day={overview.day} />
      <SectionLabel title={asOf ? `Chains · ${format.formatShortDay(asOf)}` : 'Chains'} aside={texts.flows.net} />
    </View>}
    renderItem={({ item: chain }) => {
      const { level, share } = chainFigures(overview, chain.slug);
      const day = chainDay(overview, chain.slug);
      const state = overview.status.chains.find((item) => item.chain === chain.slug);
      const delayed = state?.state === 'delayed' && state.lagHours !== null;
      return <Pressable testID={`today.chain.${chain.slug}`} accessibilityRole="button"
        onPress={() => router.push({ pathname: '/chain/[slug]', params: { slug: chain.slug } })}
        style={[screenStyles.row, screenStyles.divider, { height: rowHeight }]}>
        <Dot color={chainColor(overview.chains, chain.slug)} />
        <View style={screenStyles.grow}>
          <Text numberOfLines={1}>{chain.name}</Text>
          <Text family="mono" variant="sm" numberOfLines={2} adjustsFontSizeToFit style={screenStyles.label}>{format.formatCompact(level)} · {format.formatPercent(share, { places: 1 })}</Text>
        </View>
        <View style={styles.right}>
          <Text testID={`today.net.${chain.slug}`} family="mono" numberOfLines={1} adjustsFontSizeToFit style={{ color: netColor(day.values.net) }}>
            {compactChange(day.values.net)}
          </Text>
          <View style={styles.dots}>
            {day.unreconciled && <Text accessibilityLabel={texts.tags.unreconciledDay} variant="xs"
              style={{ color: colors['color-unreconciled'] }}>◇</Text>}
            {delayed ? <Text family="mono" variant="xs" style={{ color: colors['color-delayed'] }}>
              {texts.tags.behindShort(format.formatCount(state.lagHours))}
            </Text> : <Dot color={statusColor(state?.state)} size={6} />}
          </View>
        </View>
        <Text style={screenStyles.dim}>›</Text>
      </Pressable>;
    }} />;
}

const styles = StyleSheet.create({
  figure: { lineHeight: theme.typeScale.hero + spacing[1], letterSpacing: -2.5 },
  delta: { marginTop: spacing[2], color: colors['color-text-muted'] },
  status: { minHeight: dimensions['touch-target'] },
  dots: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[1] },
  right: { maxWidth: '40%', alignItems: 'flex-end', gap: spacing[1] },
  skeleton: { gap: spacing[2] },
});

import { useState } from 'react';
import type { ReactElement } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Overview } from '@app/contracts';
import { chainDay, TERMS } from '@app/view';
import type { PeriodId } from '@app/view';
import { Flows } from '../../charts/Flows.tsx';
import { theme } from '../../theme/index.ts';
import { texts } from '../../texts.ts';
import { chainColor, chainFigures, colors, equation, flowColors, format } from '../../view.ts';
import { explorerHome, openExplorer } from '../../ui/explorer.ts';
import { availablePeriod, Periods } from '../../ui/Periods.tsx';
import { RecordRow, recordKinds } from '../../ui/Records.tsx';
import { Button, Dot, Screen, SectionLabel, screenStyles } from '../../ui/Screen.tsx';
import { ChainStatusRow } from '../../ui/Status.tsx';
import { Text } from '../../ui/Text.tsx';

export default function ChainScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };
  return <Screen title={(overview) => {
    const chain = overview?.chains.find((item) => item.slug === slug);
    return <View style={[screenStyles.row, screenStyles.grow]}>
      {chain && <Dot color={chainColor(overview?.chains ?? [], slug)} />}
      <Text accessibilityRole="header" variant="lg" style={screenStyles.grow}>{chain?.name ?? 'Chain'}</Text>
    </View>;
  }} back={back}>
    {(overview, refresh) => <Chain overview={overview} slug={slug} refresh={refresh} />}
  </Screen>;
}

function Chain({ overview, slug, refresh }: { overview: Overview; slug: string; refresh: ReactElement }) {
  const [preferred, setPeriod] = useState<PeriodId>('30d');
  const chain = overview.chains.find((item) => item.slug === slug);
  if (!chain) return <View style={screenStyles.content}><Text style={screenStyles.label}>This chain is unavailable.</Text></View>;
  const period = availablePeriod(overview, preferred);
  const view = overview.views[period];
  const { level, share } = chainFigures(overview, slug);
  const day = chainDay(overview, slug);
  const status = overview.status.chains.find((item) => item.chain === slug);
  const explorer = explorerHome(chain.explorerTx);
  return <ScrollView contentContainerStyle={screenStyles.content} refreshControl={refresh}>
    <Text testID="chain.supply" family="mono" variant="kpi">{format.formatCompact(level)}</Text>
    <Text family="mono" variant="sm" style={screenStyles.label}>
      {share === null ? texts.noData : `${format.formatPercent(share, { places: 1 })} of tracked supply`}
    </Text>
    <SectionLabel title={day.day ? `Last day · ${format.formatShortDay(day.day)}` : 'Last day'} />
    <View style={styles.terms}>
      {TERMS.map((term) => <View key={term} style={term === 'net' ? styles.net : styles.term}>
        <View style={screenStyles.row}>
          <Dot color={flowColors[term]} size={6} />
          <Text variant="xs" family="mono" style={screenStyles.label}>{term === 'net' ? '= ' : ''}{texts.flows[term]}</Text>
        </View>
        <Text testID={`chain.${term}`} family="mono" variant="lg">{equation.termView(term, day.values[term]).compact}</Text>
      </View>)}
      {day.unreconciled && <Text variant="xs" style={styles.flag}>◇ {texts.tags.unreconciledDay}</Text>}
    </View>
    <Periods overview={overview} period={period} onChange={setPeriod} id="chain.period" />
    {view && <Flows overview={overview} view={view} scope={slug} id="chain.flows" />}
    <SectionLabel title={texts.records} />
    {recordKinds.map((kind) => {
      const record = overview.records.find((item) => item.kind === kind && item.scope === slug);
      return record ? <RecordRow key={kind} record={record} chains={overview.chains} showScope={false} /> : null;
    })}
    <SectionLabel title={texts.status} />
    {status && <ChainStatusRow chains={overview.chains} status={status} />}
    {explorer && <Button id="chain.explorer" onPress={() => { void openExplorer(explorer); }}>Open explorer</Button>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  terms: { flexDirection: 'row', flexWrap: 'wrap', rowGap: theme.spacing[2], paddingVertical: theme.spacing[3] },
  term: { width: '50%' },
  net: { width: '100%', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors['color-hairline'], paddingTop: theme.spacing[2] },
  flag: { color: colors['color-unreconciled'] },
});

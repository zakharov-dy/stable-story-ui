import { useState } from 'react';
import type { ReactElement } from 'react';
import { FlatList, Pressable, SectionList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import type { EventRow, Overview } from '@app/contracts';
import { chainInfo, signedValue } from '@app/view';
import { theme } from '../../theme/index.ts';
import { texts } from '../../texts.ts';
import { colors, flowColors, format, netColor } from '../../view.ts';
import { openExplorer } from '../../ui/explorer.ts';
import { RecordRow, recordKinds } from '../../ui/Records.tsx';
import { Button, Screen, SectionLabel, Segments, screenStyles } from '../../ui/Screen.tsx';
import { ChainStatusRow } from '../../ui/Status.tsx';
import { Text } from '../../ui/Text.tsx';

const tabs = [{ key: 'largest', label: texts.largest }, { key: 'records', label: texts.records }] as const;

export default function OperationsScreen() {
  return <Screen title={texts.operations}>{(overview, refresh) => <Operations overview={overview} refresh={refresh} />}</Screen>;
}

function Operations({ overview, refresh }: { overview: Overview; refresh: ReactElement }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof tabs)[number]['key']>('largest');
  const chooser = <Segments items={tabs} value={tab} onChange={setTab} id="operations.segment" />;
  const footer = <View style={screenStyles.section}>
    <SectionLabel title={texts.status} aside="Last closed" />
    {overview.status.chains.map((status) => <ChainStatusRow key={status.chain} chains={overview.chains} status={status} />)}
    <Button id="operations.data" onPress={() => router.push('/data')}>{texts.howWeCount}</Button>
  </View>;
  const feed = overview.largestEvents;
  if (tab === 'largest') {
    return <FlatList data={feed.items} keyExtractor={(event) => event.id} refreshControl={refresh}
      contentContainerStyle={screenStyles.content}
      ListHeaderComponent={<>{chooser}<SectionLabel title={feed.from && feed.to ? `${texts.largest} · ${format.formatRange(feed.from, feed.to)}` : texts.largest} aside={texts.utc} />
        {!feed.quality.complete && <Text variant="xs" style={screenStyles.label}>{texts.na.reasons.noDataForRange}</Text>}
        {!feed.quality.operationsComplete && <Text variant="xs" style={screenStyles.label}>{texts.na.reasons.operationsIncomplete}</Text>}
      </>}
      ListFooterComponent={footer}
      ListEmptyComponent={<Text style={[screenStyles.section, screenStyles.label]}>{texts.noOperations}</Text>}
      renderItem={({ item }) => <OperationRow event={item} chains={overview.chains} />} />;
  }
  const sections = recordKinds.map((kind) => ({
    key: kind,
    title: texts.recordKinds[kind],
    data: ['all', ...overview.chains.map((chain) => chain.slug)].flatMap((scope) =>
      overview.records.filter((record) => record.kind === kind && record.scope === scope)),
  }));
  return <SectionList sections={sections} keyExtractor={(record) => `${record.kind}:${record.scope}`} refreshControl={refresh}
    contentContainerStyle={screenStyles.content} ListHeaderComponent={chooser} ListFooterComponent={footer}
    stickySectionHeadersEnabled={false}
    renderSectionHeader={({ section }) => <SectionLabel title={section.title} />}
    renderItem={({ item }) => <RecordRow record={item} chains={overview.chains} showScope />} />;
}

function OperationRow({ event, chains }: { event: EventRow; chains: Overview['chains'] }) {
  const amount = signedValue(event.flow, event.amount);
  const color = flowColors[event.flow];
  const chain = chainInfo(chains, event.chain).name;
  const peer = event.bridge?.peer?.name;
  const route = peer ? (event.flow === 'bridge_in' ? `${peer} → ${chain}` : `${chain} → ${peer}`) : chain;
  return <Pressable testID={`operations.event.${event.id}`} accessibilityRole="link" onPress={() => { void openExplorer(event.explorerUrl); }}
    style={[screenStyles.row, screenStyles.divider, styles.operation]}>
    <View style={screenStyles.grow}>
      <Text family="mono" style={{ color: netColor(amount) }}>{format.formatCompact(amount, { signed: true })}
        {event.unreconciled && <Text variant="xs" accessibilityLabel={texts.tags.unreconciledDay}
          style={{ color: colors['color-unreconciled'] }}> ◇</Text>}
      </Text>
      <View style={screenStyles.row}>
        <Svg width={8} height={8} accessible={false}>
          {event.bridge && <Defs><Pattern id="stripe" width={3} height={3} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Rect width={1.2} height={3} fill={color} />
          </Pattern></Defs>}
          <Rect width={8} height={8} fill={event.bridge ? 'url(#stripe)' : color} />
        </Svg>
        <Text variant="xs" style={[screenStyles.grow, screenStyles.label]}>
          {texts.flows[event.flow]} · {route}{event.bridge ? ` · V${event.bridge.version}` : ''}{event.unpaired ? ' · unpaired' : ''}
        </Text>
      </View>
    </View>
    <View style={styles.date}>
      <Text variant="xs" family="mono" style={screenStyles.label}>{format.formatShortDay(event.time.slice(0, 10))}</Text>
      <Text variant="xs" family="mono" style={screenStyles.label}>{event.time.slice(11, 16)} UTC</Text>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  operation: { minHeight: theme.dimensions['row-height-operation'], paddingVertical: theme.spacing[1] },
  date: { alignItems: 'flex-end' },
});

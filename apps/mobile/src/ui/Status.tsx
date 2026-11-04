import { StyleSheet, View } from 'react-native';
import type { ChainStatus, Overview } from '@app/contracts';
import { chainInfo } from '@app/view';
import { theme } from '../theme/index.ts';
import { texts } from '../texts.ts';
import { chainColor, colors, format } from '../view.ts';
import { Dot, screenStyles } from './Screen.tsx';
import { Text } from './Text.tsx';

export function statusColor(state: ChainStatus['state'] | undefined) {
  switch (state) {
    case 'ok': return colors['color-positive'];
    case 'delayed': return colors['color-delayed'];
    case 'unreconciled': return colors['color-unreconciled'];
    default: return colors['color-text-dim'];
  }
}

export function ChainStatusRow({ chains, status }: { chains: Overview['chains']; status: ChainStatus }) {
  const name = chainInfo(chains, status.chain).name;
  return <View testID={`status.${status.chain}`} style={[styles.status, screenStyles.divider]}>
    <Dot color={chainColor(chains, status.chain)} />
    <View style={screenStyles.grow}>
      <View style={[screenStyles.row, styles.summary]}>
        <Text variant="sm">{name}</Text>
        <Text family="mono" variant="xs" style={{ color: statusColor(status.state) }}>
          {texts.chainStates[status.state]}{status.state === 'delayed' && status.lagHours !== null ? ` · ${texts.tags.behindShort(format.formatCount(status.lagHours))}` : ''}
          {status.lastClosedDay ? ` · ${format.formatShortDay(status.lastClosedDay)}` : ''}
        </Text>
      </View>
      {status.reconciliation && <Text family="mono" variant="xs" style={screenStyles.label}>
        {(['supply', 'bridge', 'continuity'] as const).map((check) => {
          const result = status.reconciliation?.[check];
          return `${check} ${result === 'ok' ? '✓' : result === 'mismatch' ? '×' : '—'}`;
        }).join(' · ')}
      </Text>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  status: { ...screenStyles.row, minHeight: theme.dimensions['tab-bar-height'], paddingVertical: theme.spacing[1] },
  summary: { justifyContent: 'space-between', flexWrap: 'wrap' },
});

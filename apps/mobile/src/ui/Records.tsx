import { StyleSheet, View } from 'react-native';
import type { Overview, RecordItem } from '@app/contracts';
import { chainInfo } from '@app/view';
import { theme } from '../theme/index.ts';
import { texts } from '../texts.ts';
import { chainColor, colors, format } from '../view.ts';
import { Dot, screenStyles } from './Screen.tsx';
import { Text } from './Text.tsx';

export const recordKinds = ['max_supply', 'max_issuer_mint_day', 'max_issuer_burn_day', 'largest_event'] as const;

export function RecordRow({ record, chains, showScope }: {
  record: RecordItem;
  chains: Overview['chains'];
  showScope: boolean;
}) {
  const name = record.scope === 'all' ? 'All' : chainInfo(chains, record.scope).name;
  const flagged = record.day !== null && record.quality.unreconciledDays.includes(record.day);
  return <View testID={`record.${record.kind}.${record.scope}`} style={[styles.row, screenStyles.divider]}>
    {showScope && <Dot color={chainColor(chains, record.scope)} />}
    <View style={screenStyles.grow}>
      <Text variant="sm">{showScope ? name : texts.recordKinds[record.kind]}</Text>
      <Text variant="xs" style={screenStyles.label}>
        {record.day ? format.formatDay(record.day) : !record.quality.complete ? texts.na.reasons.noDataForRange
          : !record.quality.operationsComplete ? texts.na.reasons.operationsIncomplete : 'No recorded value'}
      </Text>
    </View>
    <Text family="mono" variant="sm" style={flagged ? styles.flagged : undefined}
      accessibilityLabel={flagged ? `${format.formatCompact(record.value)}, ${texts.tags.unreconciledDay}` : undefined}>
      {flagged ? '◇ ' : ''}{format.formatCompact(record.value)}
    </Text>
  </View>;
}

const styles = StyleSheet.create({
  row: { ...screenStyles.row, minHeight: theme.dimensions['touch-target'], paddingVertical: theme.spacing[1] },
  flagged: { color: colors['color-unreconciled'] },
});

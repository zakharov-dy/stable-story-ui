import { View } from 'react-native';
import type { Overview } from '@app/contracts';
import { disabledPeriods, historyDays, PERIODS } from '@app/view';
import type { PeriodId } from '@app/view';
import { format } from '../view.ts';
import { Segments, screenStyles } from './Screen.tsx';
import { Text } from './Text.tsx';

export function availablePeriod(overview: Overview, preferred: PeriodId): PeriodId {
  const disabled = disabledPeriods(historyDays(overview));
  return overview.views[preferred] && !disabled.includes(preferred) ? preferred : '30d';
}

export function Periods({ overview, period, onChange, id }: {
  overview: Overview; period: PeriodId; onChange: (period: PeriodId) => void; id: string;
}) {
  const short = disabledPeriods(historyDays(overview));
  const items = PERIODS.map((key) => ({ key, label: key, disabled: short.includes(key) || !overview.views[key] }));
  return <View>
    <Segments items={items} value={period} onChange={onChange} id={id} />
    {short.length > 0 && overview.historyStart && <Text variant="xs" style={[screenStyles.dim, { marginTop: 4 }]}>
      {short.map((key) => key.toUpperCase()).join(' and ')} unavailable · history starts {format.formatDay(overview.historyStart)}.
    </Text>}
  </View>;
}

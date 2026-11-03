import { Pressable, RefreshControl, ScrollView } from 'react-native';
import Constants from 'expo-constants';
import { Text } from '../ui/Text.tsx';
import { Surface } from '../ui/Surface.tsx';
import { useOverview } from './Provider.tsx';
import { screenState } from './state.ts';

export function PlaceholderScreen() {
  const query = useOverview();
  const state = screenState(query.error, query.data);
  const refresh = (): void => { void query.refetch(); };
  return <ScrollView testID="overview.screen" refreshControl={<RefreshControl
    testID="overview.refresh" accessibilityRole="button" accessibilityLabel="Refresh overview"
    refreshing={query.isRefetching} onRefresh={refresh} />}>
    <Surface>
      <Text variant="xl" testID="overview.name">{Constants.expoConfig?.name ?? 'App'}</Text>
      <Text testID="overview.state" accessibilityLiveRegion="polite">{state}</Text>
      {state === 'unavailable' ? <Pressable testID="overview.retry" accessibilityRole="button" accessibilityLabel="Retry overview" onPress={refresh}>
        <Text>Retry</Text>
      </Pressable> : null}
      {(state === 'data' || state === 'empty') && query.data ? <>
        <Text testID="overview.as-of">asOf: {query.data.asOf ?? 'null'}</Text>
        <Text testID="overview.chains">chains: {query.data.chains.length}</Text>
        <Text testID="overview.history-start">historyStart: {query.data.historyStart ?? 'null'}</Text>
      </> : null}
    </Surface>
  </ScrollView>;
}

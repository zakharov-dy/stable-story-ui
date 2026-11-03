import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView } from 'react-native';
import { useGlobalSearchParams } from 'expo-router';
import { registerDevMenuItems } from 'expo-dev-client';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { ApiClient } from '@app/contracts';
import type { DataConfig } from '../config.ts';
import { Text } from '../../ui/Text.tsx';
import { Surface } from '../../ui/Surface.tsx';
import { scenarios, isScenario } from './scenarios.ts';
import { createDevelopmentClient } from './client.ts';
import { log } from './logger.ts';

export { createDevelopmentClient } from './client.ts';

export function DevelopmentControls({ config, replaceClient }: { config: DataConfig; replaceClient: (client: ApiClient) => void }) {
  const { devScenario, devScenarioRevision } = useGlobalSearchParams<{ devScenario?: string; devScenarioRevision?: string }>();
  const [visible, setVisible] = useState(false);
  const previous = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (__DEV__) void registerDevMenuItems([{ name: 'Select API scenario', callback: () => setVisible(true), shouldCollapse: true }]);
    return () => { if (__DEV__) void registerDevMenuItems([]); };
  }, []);
  useEffect(() => {
    const selection = `${devScenario ?? ''}:${devScenarioRevision ?? ''}`;
    if (!__DEV__ || selection === previous.current) return;
    previous.current = selection;
    if (isScenario(devScenario)) {
      replaceClient(createDevelopmentClient(config, devScenario));
      log('scenario.selected', { scenario: devScenario });
    }
  }, [devScenario, devScenarioRevision, config, replaceClient]);
  if (!__DEV__) return null;
  return <Modal visible={visible} onRequestClose={() => setVisible(false)}>
    <SafeAreaProvider><SafeAreaView style={{ flex: 1 }}><ScrollView><Surface>
      {scenarios.map((scenario) => <Pressable key={scenario} testID={`overview.scenario-${scenario}`} accessibilityRole="button" accessibilityLabel={`Select ${scenario} scenario`} onPress={() => {
        replaceClient(createDevelopmentClient(config, scenario));
        log('scenario.selected', { scenario });
        setVisible(false);
      }}><Text>{scenario}</Text></Pressable>)}
      <Pressable testID="overview.scenario-close" accessibilityRole="button" accessibilityLabel="Close scenario selection" onPress={() => setVisible(false)}><Text>Close</Text></Pressable>
    </Surface></ScrollView></SafeAreaView></SafeAreaProvider>
  </Modal>;
}

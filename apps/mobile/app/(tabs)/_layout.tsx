import { Tabs } from 'expo-router';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../src/ui/Text.tsx';
import { theme } from '../../src/theme/index.ts';
import { texts } from '../../src/texts.ts';

const { colors, dimensions } = theme;

export default function TabLayout() {
  const { bottom } = useSafeAreaInsets();
  return <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors['color-bg'] } }}
    tabBar={({ state, descriptors, emitter, navigateToTab }) => (
      <View style={[styles.bar, { paddingBottom: bottom }]}>
        {state.routes.map((route, index) => {
          const selected = state.index === index;
          const options = descriptors[route.key]?.options;
          return <Pressable key={route.key} testID={`tab.${route.name}`} accessibilityRole="tab"
            accessibilityState={{ selected }} style={styles.tab}
            onPress={() => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!selected && !event.defaultPrevented) navigateToTab(route.key);
            }}
            onLongPress={() => { emitter.emit({ type: 'tabLongPress', target: route.key }); }}>
            {selected && <View style={styles.indicator} />}
            <Text variant="sm" style={{ color: colors[selected ? 'color-text' : 'color-text-muted'] }}>{options?.title}</Text>
          </Pressable>;
        })}
      </View>
    )}>
    <Tabs.Screen name="(today)" options={{ title: texts.today }} />
    <Tabs.Screen name="history" options={{ title: texts.history }} />
    <Tabs.Screen name="operations" options={{ title: texts.operations }} />
  </Tabs>;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors['color-bg'], borderTopColor: colors['color-hairline'], borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, height: dimensions['tab-bar-height'], alignItems: 'center', justifyContent: 'center' },
  indicator: { position: 'absolute', top: 0, left: '28%', right: '28%', height: dimensions['tab-indicator'], backgroundColor: colors['color-accent'] },
});

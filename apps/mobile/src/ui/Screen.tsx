import { useEffect, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Overview } from '@app/contracts';
import { useOverview } from '../data/Provider.tsx';
import { screenState } from '../data/state.ts';
import { theme } from '../theme/index.ts';
import { texts } from '../texts.ts';
import { chainColor, colors } from '../view.ts';
import { Text } from './Text.tsx';

const { dimensions, spacing, radii } = theme;

export const screenStyles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: spacing.gutter, paddingBottom: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  label: { color: colors['color-text-muted'] },
  dim: { color: colors['color-text-dim'] },
  section: { marginTop: spacing[3] },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors['color-hairline'] },
  grow: { flex: 1 },
});

export function Screen({ title, children, loading, back, sheet = false }: {
  title: string | ((overview: Overview | undefined) => ReactNode);
  children: (overview: Overview, refresh: ReactElement) => ReactNode;
  loading?: ReactNode;
  back?: () => void;
  sheet?: boolean;
}) {
  const query = useOverview();
  const state = screenState(query.error, query.data);
  const chains = query.data?.chains ?? [];
  const refetch = () => { void query.refetch(); };
  const refresh = <RefreshControl testID="overview.refresh" accessibilityLabel={texts.refresh} refreshing={query.isRefetching}
    onRefresh={refetch} tintColor={colors['color-accent']} colors={[colors['color-accent']]} progressBackgroundColor={colors['color-surface']} />;
  return <SafeAreaView style={screenStyles.fill} edges={sheet ? ['bottom'] : ['top']}>
    <View style={styles.heading}>
      {back && <Pressable testID={sheet ? 'data.close' : 'chain.back'} accessibilityRole="button" accessibilityLabel={sheet ? texts.close : `Back to ${texts.today}`}
        onPress={back} style={styles.action}>
        <Text style={styles.link}>{sheet ? '×' : `‹ ${texts.today}`}</Text>
      </Pressable>}
      {typeof title === 'string' ? <Text variant="lg" accessibilityRole="header" style={screenStyles.grow}>{title}</Text>
        : title(state === 'data' ? query.data : undefined)}
    </View>
    {state === 'data' && query.data ? children(query.data, refresh) : (
      <ScrollView contentContainerStyle={screenStyles.content} refreshControl={refresh}>
        {state === 'loading' && (loading ?? <Skeleton style={{ height: dimensions['row-height-chain'] }} />)}
        {state === 'unavailable' && <View accessibilityLiveRegion="polite" style={styles.state}>
          <Text variant="lg" accessibilityRole="alert">{texts.unavailable}</Text>
          <Text style={screenStyles.label}>{texts.unavailableBody}</Text>
          <Button id="overview.retry" onPress={refetch}>{texts.retry}</Button>
        </View>}
        {state === 'empty' && <View accessibilityLiveRegion="polite" style={styles.state}>
          <Text variant="lg">{texts.empty}</Text>
          <Text style={screenStyles.label}>{texts.emptyBody}</Text>
          {chains.map((chain) => <View key={chain.slug} style={screenStyles.row}>
            <Dot color={chainColor(chains, chain.slug)} /><Text variant="sm">{chain.name}</Text>
          </View>)}
        </View>}
      </ScrollView>
    )}
  </SafeAreaView>;
}

export function Dot({ color, size = spacing[2] }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

export function Button({ id, children, onPress }: { id: string; children: string; onPress: () => void }) {
  return <Pressable testID={id} accessibilityRole="button" style={styles.button} onPress={onPress}><Text>{children}</Text></Pressable>;
}

export function SectionLabel({ title, aside }: { title: string; aside?: string }) {
  return <View style={[screenStyles.row, screenStyles.divider, styles.sectionLabel]}>
    <Text variant="xs" family="mono" accessibilityRole="header" style={[screenStyles.grow, screenStyles.dim]}>{title.toUpperCase()}</Text>
    {aside && <Text variant="xs" family="mono" style={screenStyles.dim}>{aside.toUpperCase()}</Text>}
  </View>;
}

export function Segments<K extends string>({ items, value, onChange, id }: {
  items: readonly { key: K; label: string; disabled?: boolean }[];
  value: K;
  onChange: (key: K) => void;
  id: string;
}) {
  return <View style={styles.segments}>
    {items.map(({ key, label, disabled = false }) => <Pressable key={key} testID={`${id}.${key}`}
      accessibilityRole="tab" accessibilityState={{ selected: key === value, disabled }} disabled={disabled}
      style={[styles.segment, key === value && styles.selected]} onPress={() => onChange(key)}>
      <Text variant="xs" family="mono" style={disabled ? styles.disabled : key === value ? styles.link : screenStyles.label}>{label.toUpperCase()}</Text>
    </Pressable>)}
  </View>;
}

export function Skeleton({ style }: { style: StyleProp<ViewStyle> }) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let active = true;
    const pulse = Animated.loop(Animated.sequence([0.45, 1].map((toValue) => Animated.timing(opacity, {
      toValue, duration: theme.durations['skeleton-pulse'] / 2, easing: Easing.inOut((time) => Easing.ease(time)), useNativeDriver: true,
    }))));
    const update = (reduced: boolean) => {
      if (!active) return;
      pulse.stop();
      pulse.reset();
      opacity.setValue(1);
      if (!reduced) pulse.start();
    };
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => { changed = true; update(value); });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (!changed) update(value); }).catch(() => {});
    return () => { active = false; subscription.remove(); pulse.stop(); };
  }, [opacity]);
  return <Animated.View style={[styles.skeleton, style, { opacity }]} />;
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginHorizontal: spacing.gutter, marginTop: spacing[1], marginBottom: spacing[2], minHeight: dimensions['touch-target'] },
  action: { minWidth: dimensions['touch-target'], minHeight: dimensions['touch-target'], alignItems: 'flex-start', justifyContent: 'center', paddingRight: spacing[2] },
  button: { borderWidth: 1, borderColor: colors['color-border'], borderRadius: radii.chip, minHeight: dimensions['touch-target'], paddingHorizontal: spacing[3], alignItems: 'center', justifyContent: 'center', marginVertical: spacing[2] },
  state: { gap: spacing[2], paddingVertical: spacing[4], alignItems: 'flex-start' },
  sectionLabel: { paddingTop: spacing[3], paddingBottom: spacing[2] },
  segments: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderColor: colors['color-hairline'], borderRadius: radii.chip, padding: dimensions['tab-indicator'] },
  segment: { flex: 1, minHeight: dimensions['touch-target'], alignItems: 'center', justifyContent: 'center', borderRadius: radii.chip },
  selected: { backgroundColor: colors['color-surface-2'], borderWidth: StyleSheet.hairlineWidth, borderColor: colors['color-border'] },
  link: { color: colors['color-accent'] },
  disabled: { color: colors['color-text-dim'], textDecorationLine: 'line-through' },
  skeleton: { backgroundColor: colors['color-surface-2'], borderRadius: radii.chip },
});

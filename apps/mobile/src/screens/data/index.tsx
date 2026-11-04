import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { theme } from '../../theme/index.ts';
import { texts } from '../../texts.ts';
import { colors, format } from '../../view.ts';
import { Screen, screenStyles } from '../../ui/Screen.tsx';
import { ChainStatusRow } from '../../ui/Status.tsx';
import { Text } from '../../ui/Text.tsx';

export default function DataScreen() {
  const router = useRouter();
  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };
  return <Screen title={texts.data} back={close} sheet>
    {(overview) => <ScrollView contentContainerStyle={screenStyles.content}>
      <Text testID="data.reconciliation" variant="sm" family="mono" style={screenStyles.label}>
        through {format.formatDay(overview.asOf)} · {overview.reconciliation.reconciledChains}/{overview.chains.length} reconciled
      </Text>
      <View style={screenStyles.section}>
        {overview.status.chains.map((status) => <ChainStatusRow key={status.chain} chains={overview.chains} status={status} />)}
      </View>
      <View style={[screenStyles.section, { gap: theme.spacing[2] }]}>
        <Text accessibilityRole="header">{texts.howWeCount}</Text>
        {[...texts.counting, texts.untracked, texts.disclaimer].map((line) =>
          <Text key={line} variant="sm" style={{ color: colors['color-text-muted'] }}>{line}</Text>)}
      </View>
    </ScrollView>}
  </Screen>;
}

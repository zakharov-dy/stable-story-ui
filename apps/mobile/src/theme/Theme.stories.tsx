import { catalogDecorator } from '../../.rnstorybook/decorators.tsx';
import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';
import { Text } from '../ui/Text.tsx';
import { theme } from './index.ts';

function Colors() {
  return <View testID="catalog.colors" style={{ gap: theme.spacing[3] }}>{Object.entries(theme.colors).map(([name, value]) => <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
    <View accessibilityLabel={name} style={{ width: theme.dimensions['swatch-size'], height: theme.dimensions['swatch-size'], borderRadius: theme.radii.swatch, backgroundColor: value }} />
    <Text variant="xs" family="mono">{name}: {value}</Text>
  </View>)}</View>;
}
function TypeScale() {
  return <View testID="catalog.type-scale" style={{ gap: theme.spacing[4] }}>{(Object.keys(theme.typeScale) as (keyof typeof theme.typeScale)[]).map((variant) => <View key={variant}>
    <Text variant={variant}>{variant} / {theme.typeScale[variant]}</Text>
    <Text variant={variant} family="mono">{variant} / 123.45</Text>
  </View>)}</View>;
}
export default { decorators: [catalogDecorator], title: 'Theme/Tokens' } satisfies Meta;
export const Colours: StoryObj = { render: () => <Colors /> };
export const Typography: StoryObj = { render: () => <TypeScale /> };

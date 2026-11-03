import { catalogDecorator } from '../../.rnstorybook/decorators.tsx';
import type { Meta, StoryObj } from '@storybook/react-native';
import { Text } from './Text.tsx';

export default { decorators: [catalogDecorator], title: 'Primitives/Text', component: Text } satisfies Meta<typeof Text>;
type Story = StoryObj<typeof Text>;
export const Default: Story = { args: { children: 'Text from shared tokens', testID: 'catalog.text' } };
export const Mono: Story = { args: { children: '1,234,567.89', variant: 'kpi', family: 'mono', testID: 'catalog.mono' } };

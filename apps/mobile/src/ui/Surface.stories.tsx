import { catalogDecorator } from '../../.rnstorybook/decorators.tsx';
import type { Meta, StoryObj } from '@storybook/react-native';
import { Surface } from './Surface.tsx';
import { Text } from './Text.tsx';
import { theme } from '../theme/index.ts';

export default { decorators: [catalogDecorator], title: 'Primitives/Surface', component: Surface } satisfies Meta<typeof Surface>;
type Story = StoryObj<typeof Surface>;
export const Default: Story = { args: { testID: 'catalog.surface', style: { padding: theme.spacing[4] }, children: <Text>Default surface</Text> } };
export const Raised: Story = { args: { background: 'surface-2', radius: 'chip', testID: 'catalog.raised', style: { padding: theme.spacing[4] }, children: <Text>Raised surface / chip radius</Text> } };

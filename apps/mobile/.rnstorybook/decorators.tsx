import type { Decorator } from '@storybook/react-native';
import { ScrollView } from 'react-native';
import { theme } from '../src/theme/index.ts';

// Story-level annotation keeps generated registration fully typed without require() annotations.
export const catalogDecorator: Decorator = (Story) => <ScrollView style={{ flex: 1, backgroundColor: theme.colors['color-bg'] }} contentContainerStyle={{ padding: theme.spacing.gutter, gap: theme.spacing[3] }}><Story /></ScrollView>;

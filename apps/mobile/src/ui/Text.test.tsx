/// <reference types="jest" />
import { it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Text } from './Text.tsx';

it('renders a token-sized mono figure and forwards native accessibility/test props', async () => {
  await render(<Text variant="kpi" family="mono" testID="text.figure" accessibilityLabel="Supply" accessibilityRole="header">42</Text>);
  const figure = screen.getByRole('header', { name: 'Supply' });
  expect(figure).toBe(screen.getByTestId('text.figure'));
  expect(figure).toHaveTextContent('42');
  expect(figure).toHaveStyle({ fontSize: 40, fontFamily: 'IBM Plex Mono', color: '#f4f1ff', fontVariant: ['tabular-nums'] });
});

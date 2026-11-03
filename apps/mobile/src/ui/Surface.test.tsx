/// <reference types="jest" />
import { it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Text } from './Text.tsx';
import { Surface } from './Surface.tsx';

it('renders the selected surface and radius with its children and native props', async () => {
  await render(<Surface background="surface-2" radius="chip" accessible accessibilityLabel="Nested surface" testID="surface.nested"><Text>Content</Text></Surface>);
  const surface = screen.getByLabelText('Nested surface');
  expect(surface).toBe(screen.getByTestId('surface.nested'));
  expect(surface).toHaveStyle({ backgroundColor: '#1a1736', borderRadius: 8 });
  expect(screen.getByText('Content')).toBeOnTheScreen();
});

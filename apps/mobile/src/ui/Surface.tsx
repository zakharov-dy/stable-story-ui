import { View } from 'react-native';
import type { ViewProps } from 'react-native';
import { theme } from '../theme/index.ts';

export type SurfaceProps = ViewProps & {
  background?: 'bg' | 'surface' | 'surface-2';
  radius?: keyof typeof theme.radii;
};

export function Surface({ background = 'surface', radius = 'radius', style, ...props }: SurfaceProps) {
  return <View {...props} style={[{
    backgroundColor: theme.colors[`color-${background}`], borderRadius: theme.radii[radius],
  }, style]} />;
}

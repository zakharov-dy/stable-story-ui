import { Text as NativeText } from 'react-native';
import type { TextProps as NativeTextProps } from 'react-native';
import { theme } from '../theme/index.ts';

export type TextProps = NativeTextProps & {
  variant?: keyof typeof theme.typeScale;
  family?: keyof typeof theme.fonts;
};

export function Text({ variant = 'md', family = 'sans', style, ...props }: TextProps) {
  return <NativeText {...props} style={[{
    color: theme.colors['color-text'], fontSize: theme.typeScale[variant],
    fontFamily: theme.fonts[family], ...(family === 'mono' && { fontVariant: ['tabular-nums'] as const }),
  }, style]} />;
}

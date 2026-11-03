import { registerRootComponent } from 'expo';
import Storybook from './index.tsx';

// Defense in depth: Metro never selects this entry for production.
if (__DEV__ && process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true') {
  registerRootComponent(Storybook);
}

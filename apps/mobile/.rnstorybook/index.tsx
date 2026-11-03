import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppFrame } from '../src/AppFrame.tsx';
import { view } from './storybook.requires.js';

const StorybookUI = view.getStorybookUI({ shouldPersistSelection: false });

export default function Storybook() {
  return <GestureHandlerRootView style={{ flex: 1 }}><AppFrame><StorybookUI /></AppFrame></GestureHandlerRootView>;
}

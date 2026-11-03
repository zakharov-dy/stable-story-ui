import { Slot } from 'expo-router';
import { AppFrame } from '../src/AppFrame.tsx';
import { DataProvider } from '../src/data/Provider.tsx';

export default function RootLayout() {
  return <AppFrame><DataProvider><Slot /></DataProvider></AppFrame>;
}

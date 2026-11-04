import { Alert, Linking } from 'react-native';

function httpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

export function explorerHome(template: string): string | null {
  return httpUrl(template)?.origin ?? null;
}

export async function openExplorer(link: string) {
  try {
    const url = httpUrl(link);
    if (!url) throw new Error('Invalid explorer link');
    await Linking.openURL(url.href);
  } catch {
    Alert.alert('Explorer unavailable', 'The link could not be opened.');
  }
}

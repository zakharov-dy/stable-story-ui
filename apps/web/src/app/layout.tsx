import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { texts } from '../texts.ts';
// Self-hosted fonts (latin subsets only): the build and the browser never contact a font CDN.
import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/first-screen.css';
import '../styles/charts.css';
import '../styles/lists.css';

export const metadata: Metadata = {
  title: texts.meta.title,
  description: texts.meta.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

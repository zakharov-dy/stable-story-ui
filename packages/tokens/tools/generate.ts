import { writeFileSync } from 'node:fs';
import { renderCss } from './render.ts';

// Resolve from the script so generation is independent of the current working directory.
writeFileSync(new URL('../../../apps/web/src/styles/tokens.css', import.meta.url), renderCss());

import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { renderCss } from './render.ts';

it('keeps the committed web CSS identical to the current token rendering', () => {
  // Never generate first: stale output must fail this read-only check in pnpm test.
  const committed = readFileSync(new URL('../../../apps/web/src/styles/tokens.css', import.meta.url), 'utf8');
  expect(committed).toBe(renderCss());
});

it('renders base values, aliases, fonts and phone overrides as CSS', () => {
  const css = renderCss();
  expect(css).toContain(':root {\n  --color-bg: #0a0916;\n');
  expect(css).toContain('  --color-chain-6: #e06c77;\n');
  expect(css).toContain('  --color-crosshair: var(--color-text-dim);\n');
  expect(css).toContain("  --font-sans: 'Space Grotesk', system-ui, sans-serif;\n");
  expect(css).toContain('  --font-size-kpi: 72px;\n');
  expect(css).toContain(`@media (max-width: 720px) {
  :root {
    --font-size-kpi: 40px;
    --font-size-hero: 64px;
    --font-size-full: 18px;
    --gutter: 16px;
  }
}
`);
});

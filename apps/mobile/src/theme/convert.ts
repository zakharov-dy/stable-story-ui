/** CSS px become React Native logical pixels, without silently accepting other units. */
export function px(value: string): number {
  if (!/^-?(?:\d+\.?\d*|\.\d+)px$/.test(value)) throw new Error(`Expected px: ${value}`);
  return Number(value.slice(0, -2));
}

/** Both hex and rgba are native colors. Resolve CSS aliases before passing them on. */
export function color(value: string, source: Readonly<Record<string, string>>, seen: readonly string[] = []): string {
  const alias = /^var\(--([\w-]+)\)$/.exec(value)?.[1];
  if (alias) {
    if (seen.includes(alias) || !(alias in source)) throw new Error(`Invalid color alias: ${value}`);
    return color(source[alias], source, [...seen, alias]);
  }
  if (/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value)) return value;
  const rgba = /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*\)$/.exec(value);
  if (rgba && rgba.slice(1, 4).every((channel) => Number(channel) <= 255)) {
    return `rgba(${Number(rgba[1])}, ${Number(rgba[2])}, ${Number(rgba[3])}, ${Number(rgba[4])})`;
  }
  throw new Error(`Unsupported color: ${value}`);
}

/** Register bundled assets using the first named family, not the CSS fallback stack. */
export function fontFamily(stack: string): string {
  const first = stack.split(',')[0].trim();
  const family = first.replace(/^(['"])(.*)\1$/, '$2');
  if (!family || /['"]/.test(family)) throw new Error(`Unsupported font stack: ${stack}`);
  return family;
}

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { texts } from './texts.ts';

const SRC = import.meta.dirname;
const APP = path.join(SRC, '..');
// Attributes a reader sees or hears.
const READABLE_ATTRIBUTES = new Set(['title', 'aria-label', 'alt', 'placeholder', 'aria-description']);

const files = (dir: string, accept: (name: string) => boolean): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name === '.next') return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full, accept) : accept(entry.name) ? [full] : [];
  });

/** User-facing literals in JSX: text with letters and literal readable attributes. */
function jsxLiterals(file: string, text = readFileSync(file, 'utf8')): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node) && /\p{L}/u.test(node.text)) found.push(node.text.trim());
    if (ts.isJsxAttribute(node) && READABLE_ATTRIBUTES.has(node.name.getText(source)) && node.initializer) {
      const value = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
      if (value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))) found.push(value.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('texts', () => {
  const components = files(SRC, (name) => name.endsWith('.tsx'));

  it('finds the components', () => {
    expect(components.length).toBeGreaterThan(5);
  });

  it.each(components.map((file) => [path.relative(SRC, file), file]))('%s has no user-facing literals', (_name, file) => {
    expect(jsxLiterals(file)).toEqual([]);
  });

  it('the guard catches literals', () => {
    const probe = 'const a = <p title="Hint" className="x">Hello {name} <b aria-label={`Label`}>{texts.noData}</b> — </p>;';
    expect(jsxLiterals('probe.tsx', probe)).toEqual(['Hint', 'Hello', 'Label']);
  });

  it('names the product only in texts.ts', () => {
    const sources = files(APP, (name) => /\.(tsx?|css|json)$/.test(name) && name !== 'texts.test.ts');
    const naming = sources.filter((file) => readFileSync(file, 'utf8').includes(texts.productName));
    expect(naming.map((file) => path.relative(APP, file))).toEqual(['src/texts.ts']);
  });
});

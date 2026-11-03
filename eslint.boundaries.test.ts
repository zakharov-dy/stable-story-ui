import path from 'node:path';
import { ESLint, RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { boundariesPlugin } from './eslint.boundaries.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({ languageOptions: { parser: tseslint.parser } });
const rule = boundariesPlugin.rules['module-boundaries'];

const file = (relative: string): string => path.join(import.meta.dirname, relative);
const contracts = file('packages/contracts/src/schemas.ts');
const tokens = file('packages/tokens/src/tokens.ts');
const view = file('packages/view/src/series.ts');
const web = file('apps/web/src/page.ts');
const mobile = file('apps/mobile/src/app.ts');

const invalid = (filename: string, code: string) => ({ filename, code, errors: 1 });

// Every supported import form with a specifier placeholder.
const forms = (specifier: string) => [
  `import { x } from '${specifier}';`,
  `export { x } from '${specifier}';`,
  `export * from '${specifier}';`,
  `const m = await import('${specifier}');`,
  `const m = await import(\`${specifier}\`);`,
  `const m = require('${specifier}');`,
  `import m = require('${specifier}');`,
  `type T = import('${specifier}').T;`,
];

const clients = [web, mobile];

describe('view portability guard', () => {
  it('rejects platform imports and globals while allowing ES APIs in production view sources', async () => {
    const eslint = new ESLint({ cwd: import.meta.dirname });
    const lint = async (code: string) => {
      const [result] = await eslint.lintText(code, { filePath: file('packages/view/src/format.ts') });
      return result?.messages.map((message) => message.ruleId);
    };

    expect(await lint("import 'node:fs'; import 'fs'; import 'react';")).toEqual([
      'no-restricted-imports', 'no-restricted-imports', 'no-restricted-imports',
    ]);
    expect(await lint("import 'react-dom'; import 'react-native-web'; import 'react-native-web/dist/index';")).toEqual([
      'no-restricted-imports', 'no-restricted-imports', 'no-restricted-imports',
    ]);
    expect(await lint('void fetch; void globalThis.fetch;')).toEqual([
      'no-restricted-globals', 'no-restricted-globals',
    ]);
    expect(await lint('void Date; void Intl; void BigInt;')).toEqual([]);
  });
});

ruleTester.run('module-boundaries', rule, {
  valid: [
    ...clients.flatMap((filename) => ['@app/contracts', '@app/tokens', '@app/view'].flatMap((specifier) =>
      forms(specifier).map((code) => ({ filename, code })))),
    ...forms('@app/contracts').map((code) => ({ filename: view, code })),
    { filename: web, code: "import { Chart } from './components/Chart.tsx'; import { x } from '../src/view.ts';" },
    { filename: mobile, code: "import { Text } from './ui/Text.tsx';" },
    { filename: contracts, code: "import { z } from 'zod'; import { x } from './client.ts';" },
    { filename: tokens, code: "import { x } from './tokens.ts';" },
    { filename: view, code: "import { x } from './format.ts';" },
    { filename: web, code: "import { chart } from '@app/view';" },
    { filename: file('packages/view/src/series.test.ts'), code: "import { series } from './series.ts';" },
    { filename: file('vitest.config.ts'), code: "import '@app/db'; import '../anything.ts';" },
  ],
  invalid: [
    ...[web, mobile].flatMap((filename) => forms('@app/db').map((code) => invalid(filename, code))),
    ...[web, mobile].flatMap((filename) => forms('@app/domain').map((code) => invalid(filename, code))),
    ...[web, mobile].flatMap((filename) => forms('@app/view/src/index.ts').map((code) => invalid(filename, code))),
    ...[web, mobile].flatMap((filename) => forms('@app/contracts/src/index.ts').map((code) => invalid(filename, code))),
    ...clients.map((filename) => invalid(filename, "import '@app/tokens/src/tokens.ts';")),
    ...clients.map((filename) => invalid(filename, "const name = '@app/contracts'; await import(name);")),
    ...clients.map((filename) => invalid(filename, "export { main } from '../../api/src/main.ts';")),
    invalid(contracts, "import type { Hex } from '@app/domain';"),
    invalid(contracts, "import '@app/tokens';"),
    invalid(contracts, "import { x } from '@app/contracts/src/index.ts';"),
    invalid(tokens, "import '@app/contracts';"),
    invalid(tokens, "import '@app/domain';"),
    ...['@app/domain', '@app/tokens', '@app/view', '@app/db'].flatMap((specifier) =>
      forms(specifier).map((code) => invalid(view, code))),
    invalid(view, "const name = '@app/contracts'; await import(name);"),
    invalid(view, "export { x } from '../../contracts/src/index.ts';"),
    invalid(file('packages/view/src/series.test.ts'), "import '@app/tokens';"),
    // Production code may not import a test file; a `.test.tsx` file is not a test file here.
    invalid(web, "import './page.test.ts';"),
    invalid(file('packages/view/src/series.test.tsx'), "import './series.test.ts';"),
  ],
});

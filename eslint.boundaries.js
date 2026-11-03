// UI module boundaries.
//
// Every import form is checked: static imports and re-exports, dynamic `import()`, `require()`,
// `import x = require()` and type-level `import('…')`. A module may import only the listed
// workspace packages (exact specifiers, so a deep import such as `@app/view/src/index.ts` is
// rejected), and a relative path must stay inside the module's own directory: the UI is
// self-contained and imports nothing outside itself. A dynamic import whose specifier is not a
// string literal is rejected, because it cannot be checked.
//
// Test files (`*.test.ts`) use the same table: the UI has no test-only package. So that production
// code cannot reach a test file, a non-test file may not import one by a relative path.

import path from 'node:path';

const ROOT = import.meta.dirname;

/** @type {{ root: string; allowed: string[]; forbidden?: string[] }[]} */
export const MODULES = [
  { root: 'packages/contracts', allowed: [] }, // no server packages
  { root: 'packages/tokens', allowed: [] }, // portable design constants, no workspace imports
  { root: 'packages/view', allowed: ['contracts'] }, // portable view logic; client-owned labels
  { root: 'apps/web', allowed: ['contracts', 'tokens', 'view'] }, // API only through ApiClient
  { root: 'apps/mobile', allowed: ['contracts', 'tokens', 'view'] },
];

const WORKSPACE_RE = /^@app\/(.+)$/;
// `.test`, `.test.ts`, `.test.js`, `.test.mts`, …: any spelling that can resolve to a test file.
const TEST_TARGET_RE = /\.test(?:\.[cm]?[jt]sx?)?$/;

/** @param {string} filename */
const isTestFile = (filename) => filename.endsWith('.test.ts');

/**
 * @param {string} filename
 * @returns {(typeof MODULES)[number] | undefined}
 */
function moduleOf(filename) {
  const relative = path.relative(ROOT, filename).split(path.sep).join('/');
  return MODULES.find((module) => relative === module.root || relative.startsWith(`${module.root}/`));
}

/**
 * @param {(typeof MODULES)[number]} module
 * @param {string} filename
 * @param {string} specifier
 * @returns {string | null} violation message
 */
function check(module, filename, specifier) {
  const where = `Module boundary, ${module.root}`;
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const target = path.resolve(path.dirname(filename), specifier);
    const own = path.join(ROOT, module.root);
    if (target !== own && !target.startsWith(own + path.sep)) {
      return `${where}: relative import '${specifier}' leaves the module; import other modules by package name.`;
    }
    return TEST_TARGET_RE.test(target) && !isTestFile(filename)
      ? `${where}: production code may not import the test file '${specifier}'.`
      : null;
  }
  const workspace = WORKSPACE_RE.exec(specifier);
  if (workspace) {
    return module.allowed.includes(workspace[1] ?? '')
      ? null
      : `${where}: '${specifier}' is not allowed; allowed workspace imports: ${
          module.allowed.map((name) => `@app/${name}`).join(', ') || 'none'
        }.`;
  }
  const forbidden = module.forbidden?.find((name) => specifier === name || specifier.startsWith(`${name}/`));
  return forbidden ? `${where}: '${specifier}' is not allowed here.` : null;
}

/** @type {import('eslint').Rule.RuleModule} */
const moduleBoundaries = {
  meta: {
    type: 'problem',
    docs: { description: 'Enforce the UI module boundaries' },
    schema: [],
  },
  create(context) {
    const module = moduleOf(context.filename);
    if (!module) return {};

    /** @param {any} node @param {any} source */
    const verify = (node, source) => {
      if (source?.type === 'Literal' && typeof source.value === 'string') {
        const message = check(module, context.filename, source.value);
        if (message) context.report({ node, message });
      } else if (source?.type === 'TemplateLiteral' && source.expressions.length === 0) {
        const message = check(module, context.filename, source.quasis[0].value.cooked);
        if (message) context.report({ node, message });
      } else {
        context.report({ node, message: 'Module boundary: import specifier must be a string literal.' });
      }
    };

    return {
      ImportDeclaration: (node) => verify(node, node.source),
      ExportAllDeclaration: (node) => verify(node, node.source),
      ExportNamedDeclaration: (node) => node.source && verify(node, node.source),
      ImportExpression: (node) => verify(node, node.source),
      CallExpression: (node) => {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require') verify(node, node.arguments[0]);
      },
      /** @param {any} node */
      TSExternalModuleReference: (node) => verify(node, node.expression),
      /** @param {any} node */
      TSImportType: (node) => verify(node, node.source ?? node.argument?.literal),
    };
  },
};

export const boundariesPlugin = { rules: { 'module-boundaries': moduleBoundaries } };

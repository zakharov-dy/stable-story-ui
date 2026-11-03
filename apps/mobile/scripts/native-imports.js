// Metro loads JSON modules without Node's import attributes. Keep contracts portable,
// adapting only native builds. Jest additionally needs CommonJS async imports.
export default function ({ types: t }) {
  return { visitor: { CallExpression(path, state) {
    if (!t.isImport(path.node.callee)) return;
    const source = path.node.arguments[0];
    if (t.isStringLiteral(source) && source.value.endsWith('.json')) path.node.arguments = [source];
    if (state.opts.jest) {
      const loaded = t.callExpression(state.addHelper('interopRequireWildcard'), [t.callExpression(t.identifier('require'), [source])]);
      path.replaceWith(t.callExpression(t.memberExpression(t.callExpression(t.memberExpression(t.identifier('Promise'), t.identifier('resolve')), []), t.identifier('then')), [t.arrowFunctionExpression([], loaded)]));
    }
  } } };
}

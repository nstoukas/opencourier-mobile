/**
 * Hard coded words in JSX (spec 0054, AC-8): the same check as eslint-plugin-i18next's
 * `no-literal-string` in its `jsx-text-only` mode, written here so the courier app needs no new package
 * (decision 47.36). It reports text written between JSX tags that has a letter in it, such as
 * `<Text>Go online</Text>`: the rider would read it in English whatever the language. Words belong in
 * src/localization and reach the screen through `t('translations:...')`. Symbols, numbers and spaces
 * alone are not reported.
 */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Text a person reads must come from the translation files',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXText(node) {
        // `\p{L}` is any letter in any alphabet, Greek included.
        if (/\p{L}/u.test(node.value)) {
          context.report({
            node,
            message: `Hard coded text "${node.value
              .trim()
              .slice(0, 40)}": use t('translations:...')`,
          });
        }
      },
      // Review fix (row 47): the same words written as a string inside { } between tags, such as
      // `<Text>{'Go online'}</Text>`, which the check above cannot see. Only a string that is the whole
      // of the { } is reported; a string inside a call (`t('...')`) or a condition is not.
      JSXExpressionContainer(node) {
        const expression = node.expression;
        const isText =
          (expression.type === 'Literal' &&
            typeof expression.value === 'string') ||
          (expression.type === 'TemplateLiteral' &&
            expression.expressions.length === 0);
        const words =
          expression.type === 'Literal'
            ? expression.value
            : isText
            ? expression.quasis[0].value.cooked
            : '';
        if (
          isText &&
          node.parent.type === 'JSXElement' &&
          /\p{L}/u.test(words)
        ) {
          context.report({
            node,
            message: `Hard coded text "${String(words)
              .trim()
              .slice(0, 40)}": use t('translations:...')`,
          });
        }
      },
    };
  },
};

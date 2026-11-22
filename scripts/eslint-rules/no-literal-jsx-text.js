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
    };
  },
};

// i18next picks a plural form ("1 item" / "2 items") with the JavaScript Intl.PluralRules API. Hermes,
// the JavaScript engine of this app on Android, does not have it, and without it i18next falls back to
// its old v3 key style and finds none of the `_one` / `_other` keys (spec 0054, cross check 12, moved
// the app to them). This adds a minimal Intl.PluralRules for the app's two languages only when the
// engine lacks one (decision 47.33). Greek and English share the same rule: "one" for exactly 1,
// "other" for everything else. No package: the two rules are all the app needs.

type PluralCategory = 'one' | 'other';

class TwoFormPluralRules {
  // `select` is what i18next calls: the form for a number.
  select(count: number): PluralCategory {
    return Math.abs(count) === 1 ? 'one' : 'other';
  }

  // i18next also reads the list of forms a language has, to order the keys.
  resolvedOptions(): { locale: string; pluralCategories: PluralCategory[] } {
    return { locale: 'el', pluralCategories: ['one', 'other'] };
  }
}

export const installPluralRules = (): void => {
  // `globalThis` is the engine's global object. The cast lets us write a property TypeScript's types say
  // is always there (it is not, on Hermes).
  const intl = (globalThis as { Intl?: Record<string, unknown> }).Intl;
  if (intl && typeof intl.PluralRules === 'function') {
    return;
  }
  if (intl) {
    intl.PluralRules = TwoFormPluralRules;
  }
};

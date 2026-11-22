import { installPluralRules } from './pluralRules';
import i18n from '@app/localization/i18n';

describe('pluralRules (spec 0054, AC-1, cross check 12, decision 47.33)', () => {
  const originalPluralRules = (globalThis as any).Intl?.PluralRules;

  afterEach(async () => {
    if ((globalThis as any).Intl) {
      (globalThis as any).Intl.PluralRules = originalPluralRules;
    }
    await i18n.changeLanguage('en');
  });

  it('installs TwoFormPluralRules when Intl.PluralRules is not defined', () => {
    delete (globalThis as any).Intl.PluralRules;

    installPluralRules();

    expect(typeof (globalThis as any).Intl.PluralRules).toBe('function');
    const instance = new (globalThis as any).Intl.PluralRules();
    expect(instance.select(1)).toBe('one');
    expect(instance.select(-1)).toBe('one');
    expect(instance.select(0)).toBe('other');
    expect(instance.select(2)).toBe('other');
    expect(instance.select(42)).toBe('other');
    expect(instance.resolvedOptions().pluralCategories).toEqual([
      'one',
      'other',
    ]);
  });

  it('does not overwrite existing Intl.PluralRules when already present', () => {
    const customPluralRules = jest.fn();
    (globalThis as any).Intl.PluralRules = customPluralRules;

    installPluralRules();

    expect((globalThis as any).Intl.PluralRules).toBe(customPluralRules);
  });

  describe('i18next v4 plural resolution in Greek and English', () => {
    it('resolves _one and _other plural forms correctly in Greek (1 είδος / 2 είδη)', async () => {
      await i18n.changeLanguage('el');

      expect(i18n.t('translations:items_count', { count: 1 })).toBe('1 είδος');
      expect(i18n.t('translations:items_count', { count: 2 })).toBe('2 είδη');
      expect(i18n.t('translations:items_count', { count: 5 })).toBe('5 είδη');
    });

    it('resolves _one and _other plural forms correctly in English (1 item / 2 items)', async () => {
      await i18n.changeLanguage('en');

      expect(i18n.t('translations:items_count', { count: 1 })).toBe('1 item');
      expect(i18n.t('translations:items_count', { count: 2 })).toBe('2 items');
      expect(i18n.t('translations:items_count', { count: 5 })).toBe('5 items');
    });
  });
});

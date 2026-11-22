import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import {
  APP_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  chooseLanguage,
  currentLanguage,
  loadSavedLanguage,
  toAppLanguage,
} from './appLanguage';
import { appLocale } from '@app/utilities/locale';

describe('appLanguage (spec 0054, AC-1, decisions 47.34, 47.49)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await i18n.changeLanguage('el');
  });

  afterEach(async () => {
    // Reset back to English for existing Jest suites
    await i18n.changeLanguage('en');
    const { setAppLocale } = require('@app/utilities/locale');
    setAppLocale('en');
  });

  it('declares APP_LANGUAGES as el and en, with Greek (el) as DEFAULT_LANGUAGE', () => {
    expect(APP_LANGUAGES).toEqual(['el', 'en']);
    expect(DEFAULT_LANGUAGE).toBe('el');
  });

  describe('toAppLanguage', () => {
    it('returns "el" for "el"', () => {
      expect(toAppLanguage('el')).toBe('el');
    });

    it('returns "en" for "en"', () => {
      expect(toAppLanguage('en')).toBe('en');
    });

    it('returns default "el" for unknown languages, null, undefined or numbers', () => {
      expect(toAppLanguage('fr')).toBe('el');
      expect(toAppLanguage('de')).toBe('el');
      expect(toAppLanguage(null)).toBe('el');
      expect(toAppLanguage(undefined)).toBe('el');
      expect(toAppLanguage(42)).toBe('el');
    });
  });

  describe('loadSavedLanguage', () => {
    it('returns and shows Greek (default) when nothing is saved on phone (fresh install)', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const lang = await loadSavedLanguage();

      expect(lang).toBe('el');
      expect(currentLanguage()).toBe('el');
      expect(appLocale()).toBe('el-GR');
    });

    it('reads saved language "en" from AsyncStorage, switches i18n and updates locale', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('en');

      const lang = await loadSavedLanguage();

      expect(AsyncStorage.getItem).toHaveBeenCalledWith(LANGUAGE_STORAGE_KEY);
      expect(lang).toBe('en');
      expect(currentLanguage()).toBe('en');
      expect(appLocale()).toBe('en-GB');
    });

    it('falls back to current language when reading AsyncStorage throws', async () => {
      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage failure'),
      );

      const lang = await loadSavedLanguage();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Could not read the saved language',
        expect.any(Error),
      );
      expect(lang).toBe('el');
      consoleSpy.mockRestore();
    });
  });

  describe('chooseLanguage', () => {
    it('switches i18n, updates app locale and persists choice in AsyncStorage', async () => {
      await chooseLanguage('en');

      expect(currentLanguage()).toBe('en');
      expect(appLocale()).toBe('en-GB');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        LANGUAGE_STORAGE_KEY,
        'en',
      );

      await chooseLanguage('el');

      expect(currentLanguage()).toBe('el');
      expect(appLocale()).toBe('el-GR');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        LANGUAGE_STORAGE_KEY,
        'el',
      );
    });

    it('catches and logs error when saving to AsyncStorage throws', async () => {
      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error('Disk full'),
      );

      await chooseLanguage('en');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Could not save the language',
        expect.any(Error),
      );
      expect(currentLanguage()).toBe('en'); // in-memory language still updated
      consoleSpy.mockRestore();
    });
  });
});

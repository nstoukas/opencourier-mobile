import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { setAppLocale } from '@app/utilities/locale';

// The language the app speaks (spec 0054, AC-1): Greek by default on a new install, English if the
// rider picks it in Settings. The choice is kept on the phone (it is the phone's, not the rider's
// account's, so logout never clears it) and sent to the server, which words mails in it.

// `as const` keeps the exact strings, so `AppLanguage` below is 'el' | 'en' rather than any string.
export const APP_LANGUAGES = ['el', 'en'] as const;
// "The type of any item of APP_LANGUAGES": 'el' | 'en'.
export type AppLanguage = (typeof APP_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: AppLanguage = 'el';
export const LANGUAGE_STORAGE_KEY = 'appLanguage';

/** Any value to a language the app speaks; anything else (missing, "fr") is Greek. */
export const toAppLanguage = (value: unknown): AppLanguage =>
  value === 'el' || value === 'en' ? value : DEFAULT_LANGUAGE;

/** The language on show now. */
export const currentLanguage = (): AppLanguage => toAppLanguage(i18n.language);

// Switches the words (i18next) and the formats (dates, money, distances) together.
const show = async (language: AppLanguage): Promise<void> => {
  setAppLocale(language);
  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }
};

/**
 * Reads the saved choice and shows it. Runs once at start (src/localization/i18n.ts starts it and
 * exports the promise as `languageReady`), before the first screen is drawn and before a push received
 * in the background words its notice. Nothing saved (a new install) or a storage error keeps the
 * language i18next started in, Greek.
 */
export const loadSavedLanguage = async (): Promise<AppLanguage> => {
  let saved: string | null = null;
  try {
    saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch (error) {
    console.log('Could not read the saved language', error);
  }
  const language = saved === null ? currentLanguage() : toAppLanguage(saved);
  await show(language);
  return language;
};

/**
 * The rider picked a language in Settings: show it at once and keep it on the phone. Telling the
 * server is the Language screen's job (putCourierLanguage), so it can say when that failed.
 */
export const chooseLanguage = async (language: AppLanguage): Promise<void> => {
  await show(language);
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch (error) {
    console.log('Could not save the language', error);
  }
};

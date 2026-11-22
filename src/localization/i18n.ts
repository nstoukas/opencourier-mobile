import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import el from './el';
import { serverEn } from './server/en';
import { serverEl } from './server/el';
import { installPluralRules } from './pluralRules';
import { DEFAULT_LANGUAGE, loadSavedLanguage } from './appLanguage';

// Spec 0054 (AC-1): the app in Greek (the default) and English. Each language has three namespaces:
// `translations` (the app's own words, `t('translations:key')`), `language`, and `server`: the
// backend's own texts (refusals by code, `server.error.*`), copied from its src/localization so a
// refusal reads in the rider's language (src/localization/serverText.ts).
const resources = {
  el: { ...el, server: serverEl.server },
  en: { ...en, server: serverEn.server },
};

// v4 plural keys (`_one`, `_other`) need Intl.PluralRules, which Hermes lacks on Android.
installPluralRules();

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources,
    // Greek until the saved choice is read (a moment, before the first screen is drawn; see below).
    lng: DEFAULT_LANGUAGE,
    // A key missing in Greek shows the English rather than the bare key. TypeScript already refuses a
    // Greek file with a key missing (el/translations.ts is typed as the English one).
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

// The saved language, read once at start. App.tsx waits for it before drawing anything, and the push
// handlers wait for it before wording a notice, so neither ever shows the wrong language first.
export const languageReady = loadSavedLanguage();

export default i18n;

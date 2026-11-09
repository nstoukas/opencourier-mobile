// AC-14: Online position transparency (spec 0034, scope row 90).
//
// The Dispatch board shows working riders on a map for dispatching.
// Value 5 allows a position used only for dispatching, and riders must be
// told plainly rather than find out:
// 1. Dispatch sees the position while the rider is working.
// 2. Used only for dispatching (giving out jobs).
// 3. No history is kept.
// 4. Nowhere does it claim the position is private or never shared.

import i18next from 'i18next';
import translations from './translations';
import '@app/localization/i18n';

describe('AC-14: Online position transparency (spec 0034, row 90)', () => {
  describe('online_sign_hidden_body (in-app alert when notifications are disabled)', () => {
    const text = translations.online_sign_hidden_body;

    it('says dispatch sees the position while the rider is working', () => {
      // Must state dispatch sees where the rider is / position while working
      expect(text).toMatch(/dispatch/i);
      expect(text).toMatch(/see|visible/i);
      expect(text).toMatch(/where you are|position|location/i);
      expect(text).toMatch(/work/i);
    });

    it('says position is used only for dispatching (giving out jobs)', () => {
      // Must state it is used only to give out jobs / dispatch
      expect(text).toMatch(/only/i);
      expect(text).toMatch(/only.*(give out jobs|dispatch)/i);
    });

    it('says no history is kept', () => {
      // Must state no history is kept / stored
      expect(text).toMatch(/no.*history/i);
      expect(text).toMatch(/kept|stored|saved|retained/i);
    });

    it('nowhere claims the position is private or never shared', () => {
      // Claiming the position is private or never shared would be false
      expect(text).not.toMatch(/private/i);
      expect(text).not.toMatch(/never shared/i);
      expect(text).not.toMatch(/not shared/i);
    });

    it('preserves the notification explanation for Android', () => {
      expect(text).toMatch(
        /Android will not show the "OpenCourier is online" sign while notifications are off/i,
      );
    });

    it('resolves the same text through i18next', () => {
      expect(i18next.t('translations:online_sign_hidden_body')).toBe(text);
    });
  });

  describe('online_service_body_waiting (foreground service notification while waiting)', () => {
    const text = translations.online_service_body_waiting;

    it('says dispatch sees the position while the rider is working', () => {
      // Must state dispatch sees where the rider is / position while working
      expect(text).toMatch(/dispatch/i);
      expect(text).toMatch(/see|visible/i);
      expect(text).toMatch(/where you are|position|location/i);
      expect(text).toMatch(/work/i);
    });

    it('says position is used only for dispatching (giving out jobs)', () => {
      // Must state it is used only to give out jobs / dispatch
      expect(text).toMatch(/only/i);
      expect(text).toMatch(/only.*(give out jobs|dispatch)/i);
    });

    it('says no history is kept', () => {
      // Must state no history is kept / stored
      expect(text).toMatch(/no.*history/i);
      expect(text).toMatch(/kept|stored|saved|retained/i);
    });

    it('nowhere claims the position is private or never shared', () => {
      // Claiming the position is private or never shared would be false
      expect(text).not.toMatch(/private/i);
      expect(text).not.toMatch(/never shared/i);
      expect(text).not.toMatch(/not shared/i);
    });

    it('preserves the instruction to go offline to stop', () => {
      expect(text).toMatch(/go offline to stop/i);
    });

    it('resolves the same text through i18next', () => {
      expect(i18next.t('translations:online_service_body_waiting')).toBe(text);
    });
  });
});

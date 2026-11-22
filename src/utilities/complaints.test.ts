import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_TEXT_MAX_LENGTH,
  complaintCategoryKey,
} from './complaints';
import { ComplaintAbout } from '@app/types/types';

// Spec 0052 (AC-1): Fixed categories per 'about' party, text limit, and translation keys.
describe('complaints utility (spec 0052, AC-1)', () => {
  it('defines the exact fixed categories per about party according to AC-1', () => {
    expect(COMPLAINT_CATEGORIES.RESTAURANT).toEqual([
      'LONG_WAIT',
      'FOOD_NOT_READY',
      'UNSAFE_PACKAGING',
      'RUDE_STAFF',
      'OTHER',
    ]);

    expect(COMPLAINT_CATEGORIES.CUSTOMER).toEqual([
      'ABUSE_OR_THREAT',
      'UNSAFE_ADDRESS',
      'NOT_ANSWERING',
      'OTHER',
    ]);

    expect(COMPLAINT_CATEGORIES.RIDER).toEqual([
      'LATE',
      'RUDE',
      'FOOD_DAMAGED',
      'OTHER',
    ]);
  });

  it('enforces a maximum complaint text length of 1000 characters', () => {
    expect(COMPLAINT_TEXT_MAX_LENGTH).toBe(1000);
  });

  it('generates the expected translation key for any category code', () => {
    expect(complaintCategoryKey('LONG_WAIT')).toBe(
      'translations:complaint_category_LONG_WAIT',
    );
    expect(complaintCategoryKey('OTHER')).toBe(
      'translations:complaint_category_OTHER',
    );
  });

  it('has corresponding translated strings in en translations for all defined categories', () => {
    const allAbouts: ComplaintAbout[] = ['RESTAURANT', 'CUSTOMER', 'RIDER'];
    for (const about of allAbouts) {
      for (const cat of COMPLAINT_CATEGORIES[about]) {
        const key = complaintCategoryKey(cat);
        const translated = i18n.t(key);
        // Translation must not return the raw key
        expect(translated).not.toBe(key);
        expect(translated.length).toBeGreaterThan(0);
      }
    }
  });
});

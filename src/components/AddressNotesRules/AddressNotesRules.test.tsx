import React from 'react';
import { render } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import {
  AddressNotesRules,
  aboutMonthsCount,
} from './AddressNotesRules';

// Spec 0053 (AC-6, AC-8):
// AddressNotesRules displays the 5 key rules governing address notes:
// 1. What notes are for (places, entrance, broken bell, dog, visible within ~30m, no author name).
// 2. Personal data rule (no names, phones, emails).
// 3. Retention period (default ~6 months / retentionDays, reset on upvote).
// 4. Flagging and admin deletion.
// 5. Upvotes count for note, never for author.
describe('AddressNotesRules component (spec 0053, AC-8)', () => {
  describe('aboutMonthsCount (AC-6, AC-8)', () => {
    it('rounds days to nearest month, minimum 1', () => {
      expect(aboutMonthsCount(182)).toBe(6); // ~6 months
      expect(aboutMonthsCount(30)).toBe(1);
      expect(aboutMonthsCount(60)).toBe(2);
      expect(aboutMonthsCount(90)).toBe(3);
      expect(aboutMonthsCount(365)).toBe(12);
      expect(aboutMonthsCount(10)).toBe(1); // minimum 1
      expect(aboutMonthsCount(0)).toBe(1);
      expect(aboutMonthsCount(-5)).toBe(1);
    });
  });

  describe('rendering', () => {
    it('renders all 5 rules with live retentionDays figure when provided', () => {
      const { getByTestId, getByText } = render(
        <AddressNotesRules retentionDays={182} />,
      );

      expect(getByTestId('address-notes-rules')).toBeTruthy();

      // Rule 1: What notes are for
      expect(
        getByText(i18n.t('translations:address_note_rules_for')),
      ).toBeTruthy();

      // Rule 2: Personal data rule
      expect(
        getByText(i18n.t('translations:address_note_rules_person')),
      ).toBeTruthy();

      // Rule 3: Retention rule with days and months
      const expectedRetention = i18n.t(
        'translations:address_note_rules_retention',
        {
          days: 182,
          months: i18n.t('translations:address_note_about_months', {
            count: 6,
          }),
        },
      );
      expect(getByText(expectedRetention)).toBeTruthy();

      // Rule 4: Flagging and admin deletion
      expect(
        getByText(i18n.t('translations:address_note_rules_flag')),
      ).toBeTruthy();

      // Rule 5: Upvotes count for note, never author
      expect(
        getByText(i18n.t('translations:address_note_rules_votes')),
      ).toBeTruthy();
    });

    it('renders fallback retention text when retentionDays is undefined or 0', () => {
      const { getByText } = render(<AddressNotesRules retentionDays={undefined} />);

      expect(
        getByText(i18n.t('translations:address_note_rules_retention_unknown')),
      ).toBeTruthy();
    });

    it('renders fallback retention text when retentionDays is 0', () => {
      const { getByText } = render(<AddressNotesRules retentionDays={0} />);

      expect(
        getByText(i18n.t('translations:address_note_rules_retention_unknown')),
      ).toBeTruthy();
    });
  });
});

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { JobNote, LEAVE_AT_DOOR } from '@app/utilities/jobCard';
import { JobNotesLine } from './JobNotesLine';

describe('JobNotesLine (spec 0021, AC-14)', () => {
  it('renders null when notes is empty (no notes, no line)', () => {
    const { toJSON } = render(<JobNotesLine notes={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders a single note without +N counter', () => {
    const notes: JobNote[] = [
      { author: 'customer', text: 'Please ring the doorbell twice' },
    ];

    const { getByTestId, getByText, queryByText } = render(
      <JobNotesLine notes={notes} />,
    );

    expect(getByTestId('job-notes-line')).toBeTruthy();
    expect(getByText('Please ring the doorbell twice')).toBeTruthy();
    expect(queryByText(/\+/)).toBeNull();
  });

  it('renders translated "Leave at door" and +N for multiple notes', () => {
    const notes: JobNote[] = [
      { author: 'door', text: LEAVE_AT_DOOR },
      { author: 'customer', text: 'Knock gently' },
      { author: 'restaurant', text: 'Pizza box is hot' },
    ];

    const { getByTestId, getByText } = render(<JobNotesLine notes={notes} />);

    expect(getByTestId('job-notes-line')).toBeTruthy();
    expect(getByText(i18n.t('translations:leave_at_door'))).toBeTruthy();
    expect(getByText('+2')).toBeTruthy();
  });

  it('opens sheet grouping notes by Customer, Restaurant, and Co-op riders', () => {
    const notes: JobNote[] = [
      { author: 'door', text: LEAVE_AT_DOOR },
      { author: 'customer', text: 'Gate code 4321' },
      { author: 'restaurant', text: 'Careful with drinks' },
      { author: 'riders', text: 'Beware of dog in yard' },
    ];

    const { getByTestId, getByText, getAllByText } = render(
      <JobNotesLine notes={notes} />,
    );

    fireEvent.press(getByTestId('job-notes-line'));

    expect(getByTestId('job-notes-sheet')).toBeTruthy();

    // Section headers
    expect(getByText(i18n.t('translations:notes_from_customer'))).toBeTruthy();
    expect(
      getByText(i18n.t('translations:notes_from_restaurant')),
    ).toBeTruthy();
    expect(getByText(i18n.t('translations:notes_from_riders'))).toBeTruthy();

    // Notes content
    expect(
      getAllByText(i18n.t('translations:leave_at_door')).length,
    ).toBeGreaterThanOrEqual(2);
    expect(getByText('Gate code 4321')).toBeTruthy();
    expect(getByText('Careful with drinks')).toBeTruthy();
    expect(getByText('Beware of dog in yard')).toBeTruthy();
  });
});

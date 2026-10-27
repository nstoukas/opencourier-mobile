import React from 'react';
import { render } from '@testing-library/react-native';
import { InstanceCell } from './InstanceCell';
import { Instance } from '@app/types/types';
import { APP_LOCALE } from '@app/utilities/locale';
import '@app/localization/i18n';

describe('InstanceCell (row 66 review fix)', () => {
  const testInstance: Instance = {
    details: {
      name: 'Volos Workers Co-op',
      link: 'https://volos.example.com',
      imageUrl: 'https://example.com/logo.png',
    },
    registry: {
      lastFetchedAt: '2026-10-27T16:45:00.000Z',
    },
  } as any;

  it('shows lastFetchedAt formatted with en-GB (day before month, 24 hour), never en-US', () => {
    const { getByText, queryByText } = render(
      <InstanceCell instance={testInstance} onPress={() => {}} />,
    );

    const expectedDateStr = new Date(
      testInstance.registry.lastFetchedAt,
    ).toLocaleString(APP_LOCALE);
    const usDateStr = new Date(
      testInstance.registry.lastFetchedAt,
    ).toLocaleString('en-US');

    // Shows the date formatted using APP_LOCALE (en-GB)
    expect(getByText(new RegExp(expectedDateStr))).toBeDefined();

    // en-GB puts day before month (27/10/2026), never month before day (10/27/2026)
    expect(getByText(/27\/10\/2026/)).toBeDefined();
    expect(queryByText(/10\/27\/2026/)).toBeNull();

    // en-GB uses 24-hour time without AM or PM
    expect(queryByText(/AM|PM/)).toBeNull();

    // Distinguishable from en-US
    expect(expectedDateStr).not.toEqual(usDateStr);
  });
});

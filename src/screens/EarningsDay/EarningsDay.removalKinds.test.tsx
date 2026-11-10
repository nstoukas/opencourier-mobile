import React from 'react';
import { render, screen } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { EarningsDay } from './EarningsDay';
import { useEarningsDay } from '@app/hooks/useEarningsDay';
import { EarningsDelivery } from '@app/types/types';

jest.mock('@app/hooks/useEarningsDay');

describe('EarningsDay removal and return trip kinds (spec 0035, AC-17, Behaviour 11)', () => {
  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  const defaultProps: any = {
    navigation: mockNavigation,
    route: { params: { date: '2026-11-09' } },
  };

  it('shows Removal from an order and Return trip as their own kinds on the day list', () => {
    const deliveries: EarningsDelivery[] = [
      {
        deliveryId: 'del-rem-1',
        pickupBusinessName: 'Souvlaki Bar',
        dropoffAddress: 'Ermou 15',
        droppedOffAt: '2026-11-09T13:00:00Z',
        compensation: 250,
        tips: 0,
        total: 250,
        kind: 'REMOVAL_COMPENSATION',
      },
      {
        deliveryId: 'del-ret-2',
        pickupBusinessName: 'Pizza Bistro',
        dropoffAddress: 'Iasonos 40',
        droppedOffAt: '2026-11-09T14:00:00Z',
        compensation: 180,
        tips: 0,
        total: 180,
        kind: 'RETURN_TRIP',
      },
      {
        deliveryId: 'del-norm-3',
        pickupBusinessName: 'Burger Spot',
        dropoffAddress: 'Pavlou Mela 5',
        droppedOffAt: '2026-11-09T15:00:00Z',
        compensation: 320,
        tips: 50,
        total: 370,
        kind: undefined,
      },
    ];

    (useEarningsDay as jest.Mock).mockReturnValue({
      deliveries,
      deliveryCount: 3,
      compensation: 750,
      tips: 50,
      total: 800,
      currency: 'EUR',
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });

    render(<EarningsDay {...defaultProps} />);

    // Removal label is displayed for del-rem-1
    expect(
      screen.getByText(i18n.t('translations:earnings_removal')),
    ).toBeTruthy();

    // Return trip label is displayed for del-ret-2
    expect(
      screen.getByText(i18n.t('translations:earnings_return_trip')),
    ).toBeTruthy();
  });
});

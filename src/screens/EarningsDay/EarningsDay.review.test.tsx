import React from 'react';
import { render, screen } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { EarningsDay } from './EarningsDay';
import { useEarningsDay } from '@app/hooks/useEarningsDay';
import { EarningsDelivery } from '@app/types/types';

jest.mock('@app/hooks/useEarningsDay');

describe('EarningsDay review correction kind (spec 0038, AC-7, AC-10)', () => {
  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  const defaultProps: any = {
    navigation: mockNavigation,
    route: { params: { date: '2026-11-19' } },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "Review correction" label for items with kind REVIEW_CORRECTION', () => {
    const deliveries: EarningsDelivery[] = [
      {
        deliveryId: 'del-rev-1',
        pickupBusinessName: 'Pizza Bistro',
        dropoffAddress: null,
        droppedOffAt: '2026-11-19T14:00:00Z',
        compensation: 150,
        tips: 0,
        total: 150,
        kind: 'REVIEW_CORRECTION',
      },
    ];

    (useEarningsDay as jest.Mock).mockReturnValue({
      deliveries,
      currency: 'EUR',
      totalEarnings: 150,
      totalCompensation: 150,
      totalTips: 0,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    render(<EarningsDay {...defaultProps} />);

    expect(
      screen.getByText(i18n.t('translations:earnings_review_correction')),
    ).toBeTruthy();
    expect(screen.getByText('€1.50')).toBeTruthy();
  });

  it('formats REVIEW_CORRECTION in delivery currency, never assumed euro', () => {
    const deliveries: EarningsDelivery[] = [
      {
        deliveryId: 'del-rev-usd',
        pickupBusinessName: 'Diner USA',
        dropoffAddress: null,
        droppedOffAt: '2026-11-19T15:00:00Z',
        compensation: 250,
        tips: 0,
        total: 250,
        kind: 'REVIEW_CORRECTION',
      },
    ];

    (useEarningsDay as jest.Mock).mockReturnValue({
      deliveries,
      currency: 'USD',
      totalEarnings: 250,
      totalCompensation: 250,
      totalTips: 0,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    render(<EarningsDay {...defaultProps} />);

    expect(
      screen.getByText(i18n.t('translations:earnings_review_correction')),
    ).toBeTruthy();
    expect(screen.getByText('US$2.50')).toBeTruthy();
    expect(screen.queryByText('€2.50')).toBeNull();
  });
});

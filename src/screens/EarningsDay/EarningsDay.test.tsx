import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { EarningsDay } from './EarningsDay';
import { useEarningsDay } from '@app/hooks/useEarningsDay';
import { EarningsDelivery } from '@app/types/types';
import { MainScreens } from '@app/navigation/main/types';
import i18n from '@app/localization/i18n';

jest.mock('@app/hooks/useEarningsDay');

describe('EarningsDay (spec 0015, AC-15)', () => {
  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  const defaultProps: any = {
    navigation: mockNavigation,
    route: { params: { date: '2026-11-01' } },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows "Cancelled job" only for kind CANCELLATION_COMPENSATION, not for reassignment or normal deliveries', () => {
    const deliveries: EarningsDelivery[] = [
      {
        deliveryId: 'del-cancelled-1',
        pickupBusinessName: 'Pizza Roma',
        dropoffAddress: 'Ermou 10',
        droppedOffAt: '2026-11-01T12:00:00Z',
        compensation: 280,
        tips: 0,
        total: 280,
        kind: 'CANCELLATION_COMPENSATION',
      },
      {
        deliveryId: 'del-reassigned-2',
        pickupBusinessName: 'Burger Joint',
        dropoffAddress: 'Iasonos 45',
        droppedOffAt: '2026-11-01T13:00:00Z',
        compensation: 150,
        tips: 0,
        total: 150,
        kind: 'REASSIGNMENT_COMPENSATION',
      },
      {
        deliveryId: 'del-normal-3',
        pickupBusinessName: 'Gyros Express',
        dropoffAddress: 'Dimitriadis 20',
        droppedOffAt: '2026-11-01T14:00:00Z',
        compensation: 350,
        tips: 50,
        total: 400,
        kind: undefined,
      },
    ];

    (useEarningsDay as jest.Mock).mockReturnValue({
      deliveries,
      deliveryCount: 3,
      compensation: 780,
      tips: 50,
      total: 830,
      currency: 'EUR',
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });

    render(<EarningsDay {...defaultProps} />);

    // Exactly one "Cancelled job" label is displayed (for del-cancelled-1)
    const cancelledLabels = screen.getAllByText(
      i18n.t('translations:earnings_cancelled_job'),
    );
    expect(cancelledLabels).toHaveLength(1);

    // Business names and totals are displayed
    expect(screen.getByText('Pizza Roma')).toBeTruthy();
    expect(screen.getByText('Burger Joint')).toBeTruthy();
    expect(screen.getByText('Gyros Express')).toBeTruthy();

    // Tapping on cell navigates to EarningsDelivery
    fireEvent.press(screen.getByText('Pizza Roma'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      MainScreens.EarningsDelivery,
      { deliveryId: 'del-cancelled-1' },
    );
  });

  it('renders empty view when no deliveries exist for the day', () => {
    (useEarningsDay as jest.Mock).mockReturnValue({
      deliveries: [],
      deliveryCount: 0,
      compensation: 0,
      tips: 0,
      total: 0,
      currency: 'EUR',
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });

    render(<EarningsDay {...defaultProps} />);

    expect(screen.getByText(i18n.t('translations:no_earnings'))).toBeTruthy();
    expect(
      screen.queryByText(i18n.t('translations:earnings_cancelled_job')),
    ).toBeNull();
  });

  it('shows "Waiting" label on a WAITING day row (spec 0033, AC-5)', () => {
    const deliveries: EarningsDelivery[] = [
      {
        deliveryId: 'del-waiting-1',
        pickupBusinessName: 'Bakery Central',
        dropoffAddress: null,
        droppedOffAt: '2026-11-09T10:30:00Z',
        compensation: 120, // 12 minutes wait
        tips: 0,
        total: 120,
        kind: 'WAITING',
      },
      {
        deliveryId: 'del-normal-2',
        pickupBusinessName: 'Pizza Roma',
        dropoffAddress: 'Ermou 10',
        droppedOffAt: '2026-11-09T11:00:00Z',
        compensation: 350,
        tips: 50,
        total: 400,
        kind: undefined,
      },
    ];

    (useEarningsDay as jest.Mock).mockReturnValue({
      deliveries,
      deliveryCount: 2,
      compensation: 470,
      tips: 50,
      total: 520,
      currency: 'EUR',
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });

    render(<EarningsDay {...defaultProps} />);

    // Exactly one "Waiting" label is displayed (for del-waiting-1)
    const waitingLabels = screen.getAllByText(
      i18n.t('translations:earnings_waiting'),
    );
    expect(waitingLabels).toHaveLength(1);

    // Business names are displayed
    expect(screen.getByText('Bakery Central')).toBeTruthy();
    expect(screen.getByText('Pizza Roma')).toBeTruthy();

    // Normal delivery does not show "Waiting"
    expect(
      screen.queryByText(i18n.t('translations:earnings_cancelled_job')),
    ).toBeNull();
  });
});

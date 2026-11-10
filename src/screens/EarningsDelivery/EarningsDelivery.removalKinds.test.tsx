import React from 'react';
import { render, screen } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { EarningsDelivery } from './EarningsDelivery';
import { useEarningsDelivery } from '@app/hooks/useEarningsDelivery';
import { EarningsDeliveryDetail } from '@app/types/types';

jest.mock('@app/hooks/useEarningsDelivery');

describe('EarningsDelivery removal and return trip kinds (spec 0035, AC-17, Behaviour 11)', () => {
  const defaultProps: any = {
    navigation: { goBack: jest.fn() },
    route: { params: { deliveryId: 'del-detail-test' } },
  };

  it('shows Removal from an order as the main label, hides dropoff address, and shows Paid on for REMOVAL_COMPENSATION', () => {
    const removalDetail: EarningsDeliveryDetail = {
      deliveryId: 'del-removal-detail',
      pickupBusinessName: 'Souvlaki Bar',
      dropoffAddress: 'Ermou 15, Volos',
      droppedOffAt: '2026-11-09T13:00:00Z',
      compensation: 280,
      tips: 0,
      total: 280,
      currency: 'EUR',
      kind: 'REMOVAL_COMPENSATION',
    };

    (useEarningsDelivery as jest.Mock).mockReturnValue({
      delivery: removalDetail,
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });

    render(<EarningsDelivery {...defaultProps} />);

    // Compensation row label is "Removal from an order"
    expect(
      screen.getByText(i18n.t('translations:earnings_removal')),
    ).toBeTruthy();
    expect(screen.getAllByText('€2.80')).toHaveLength(2);

    // Does NOT show "Delivered to" or the dropoff address because order was removed
    expect(screen.queryByText(i18n.t('translations:delivered_to'))).toBeNull();
    expect(screen.queryByText('Ermou 15, Volos')).toBeNull();

    // Shows "Paid on" instead of "Delivered on"
    expect(
      screen.getByText(i18n.t('translations:earnings_paid_on')),
    ).toBeTruthy();
    expect(screen.queryByText(i18n.t('translations:delivered_on'))).toBeNull();
  });

  it('shows Return trip as the main label, hides dropoff address, and shows Paid on for RETURN_TRIP', () => {
    const returnTripDetail: EarningsDeliveryDetail = {
      deliveryId: 'del-return-detail',
      pickupBusinessName: 'Pizza Bistro',
      dropoffAddress: 'Iasonos 40, Volos',
      droppedOffAt: '2026-11-09T14:00:00Z',
      compensation: 190,
      tips: 0,
      total: 190,
      currency: 'EUR',
      kind: 'RETURN_TRIP',
    };

    (useEarningsDelivery as jest.Mock).mockReturnValue({
      delivery: returnTripDetail,
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });

    render(<EarningsDelivery {...defaultProps} />);

    // Compensation row label is "Return trip"
    expect(
      screen.getByText(i18n.t('translations:earnings_return_trip')),
    ).toBeTruthy();
    expect(screen.getAllByText('€1.90')).toHaveLength(2);

    // Dropoff address hidden and Paid on displayed
    expect(screen.queryByText(i18n.t('translations:delivered_to'))).toBeNull();
    expect(
      screen.getByText(i18n.t('translations:earnings_paid_on')),
    ).toBeTruthy();
  });

  it('shows Return trip breakdown row when returnTripPay is present on a delivery detail', () => {
    const detailWithReturnTripPay: EarningsDeliveryDetail = {
      deliveryId: 'del-cancelled-with-return',
      pickupBusinessName: 'Taverna Ouzeri',
      dropoffAddress: 'Dimitriadis 10, Volos',
      droppedOffAt: '2026-11-09T15:00:00Z',
      compensation: 250,
      tips: 0,
      returnTripPay: 150, // €1.50 return trip
      total: 400,
      currency: 'EUR',
    };

    (useEarningsDelivery as jest.Mock).mockReturnValue({
      delivery: detailWithReturnTripPay,
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });

    render(<EarningsDelivery {...defaultProps} />);

    // Shows Return trip row with €1.50
    expect(
      screen.getByText(i18n.t('translations:earnings_return_trip')),
    ).toBeTruthy();
    expect(screen.getByText('€1.50')).toBeTruthy();
  });

  it('shows no Return trip line when returnTripPay is absent on an ordinary delivery (AC-17)', () => {
    const ordinaryDetail: EarningsDeliveryDetail = {
      deliveryId: 'del-ordinary-absent',
      pickupBusinessName: 'Burger Spot',
      dropoffAddress: 'Pavlou Mela 5, Volos',
      droppedOffAt: '2026-11-09T16:00:00Z',
      compensation: 320,
      tips: 50,
      total: 370,
      currency: 'EUR',
    };

    (useEarningsDelivery as jest.Mock).mockReturnValue({
      delivery: ordinaryDetail,
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });

    render(<EarningsDelivery {...defaultProps} />);

    expect(
      screen.queryByText(i18n.t('translations:earnings_return_trip')),
    ).toBeNull();
  });

  it('shows no Return trip line when returnTripPay is null on a delivery (AC-17)', () => {
    const detailWithNullReturnTrip: EarningsDeliveryDetail = {
      deliveryId: 'del-ordinary-null',
      pickupBusinessName: 'Burger Spot',
      dropoffAddress: 'Pavlou Mela 5, Volos',
      droppedOffAt: '2026-11-09T16:00:00Z',
      compensation: 320,
      tips: 50,
      returnTripPay: null as any,
      total: 370,
      currency: 'EUR',
    };

    (useEarningsDelivery as jest.Mock).mockReturnValue({
      delivery: detailWithNullReturnTrip,
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });

    render(<EarningsDelivery {...defaultProps} />);

    expect(
      screen.queryByText(i18n.t('translations:earnings_return_trip')),
    ).toBeNull();
  });
});

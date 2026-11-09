import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { EarningsDelivery } from './EarningsDelivery';
import { useEarningsDelivery } from '@app/hooks/useEarningsDelivery';
import { EarningsDeliveryDetail } from '@app/types/types';
import i18n from '@app/localization/i18n';

jest.mock('@app/hooks/useEarningsDelivery');

describe('EarningsDelivery (spec 0009, AC-1)', () => {
  const mockDeliveryDetail: EarningsDeliveryDetail = {
    deliveryId: 'del-123',
    pickupBusinessName: 'Souvlaki Express',
    dropoffAddress: 'Dimitriadis 25, Volos',
    droppedOffAt: '2026-10-31T20:00:00Z',
    compensation: 350,
    tips: 100,
    total: 450,
    currency: 'EUR',
  };

  const defaultProps: any = {
    navigation: { goBack: jest.fn() },
    route: { params: { deliveryId: 'del-123' } },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps showing a loaded delivery when a refetch fails (AC-1)', () => {
    // Delivery is in cache, but a background refetch failed (e.g. no signal)
    (useEarningsDelivery as jest.Mock).mockReturnValue({
      delivery: mockDeliveryDetail,
      isLoading: false,
      isError: true,
      isRefetching: false,
      refetch: jest.fn().mockRejectedValue(new Error('Network request failed')),
    });

    render(<EarningsDelivery {...defaultProps} />);

    // Screen keeps displaying the cached delivery details
    expect(screen.getByText('Souvlaki Express')).toBeTruthy();
    expect(screen.getByText('Dimitriadis 25, Volos')).toBeTruthy();
    expect(screen.getByText('del-123')).toBeTruthy();
    expect(screen.getByText('€4.50')).toBeTruthy();

    // Does NOT show the empty "delivery not found" error
    expect(
      screen.queryByText(i18n.t('translations:delivery_not_found')),
    ).toBeNull();
  });

  it('shows delivery_not_found when there is no cached delivery data and loading has finished', () => {
    (useEarningsDelivery as jest.Mock).mockReturnValue({
      delivery: undefined,
      isLoading: false,
      isError: true,
      isRefetching: false,
      refetch: jest.fn(),
    });

    render(<EarningsDelivery {...defaultProps} />);

    expect(
      screen.getByText(i18n.t('translations:delivery_not_found')),
    ).toBeTruthy();
    expect(screen.queryByText('Souvlaki Express')).toBeNull();
  });

  describe('Waiting amount on delivered detail (spec 0033, AC-5, decision 23.11)', () => {
    it('shows Waiting row with formatted currency when waitingPay is present', () => {
      const deliveryWithWait: EarningsDeliveryDetail = {
        ...mockDeliveryDetail,
        waitingPay: 150, // €1.50
        total: 600,
      };

      (useEarningsDelivery as jest.Mock).mockReturnValue({
        delivery: deliveryWithWait,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      // Shows "Waiting" label and formatted currency value "€1.50"
      expect(
        screen.getByText(i18n.t('translations:earnings_waiting')),
      ).toBeTruthy();
      expect(screen.getByText('€1.50')).toBeTruthy();
    });

    it('hides Waiting row when waitingPay is 0, undefined, or null', () => {
      // 1. undefined
      (useEarningsDelivery as jest.Mock).mockReturnValue({
        delivery: { ...mockDeliveryDetail, waitingPay: undefined },
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      const { rerender } = render(<EarningsDelivery {...defaultProps} />);
      expect(
        screen.queryByText(i18n.t('translations:earnings_waiting')),
      ).toBeNull();

      // 2. 0
      (useEarningsDelivery as jest.Mock).mockReturnValue({
        delivery: { ...mockDeliveryDetail, waitingPay: 0 },
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      rerender(<EarningsDelivery {...defaultProps} />);
      expect(
        screen.queryByText(i18n.t('translations:earnings_waiting')),
      ).toBeNull();
    });
  });

  describe('Kind WAITING vs normal delivery presentation (spec 0033, review ruling)', () => {
    it('with kind WAITING labels the amount Waiting, shows Paid on, and shows no Delivered to', () => {
      const waitCompensationDetail: EarningsDeliveryDetail = {
        ...mockDeliveryDetail,
        kind: 'WAITING',
      };

      (useEarningsDelivery as jest.Mock).mockReturnValue({
        delivery: waitCompensationDetail,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      // 1. Labels the compensation amount "Waiting", not "Piece-rate pay"
      expect(
        screen.getByText(i18n.t('translations:earnings_waiting')),
      ).toBeTruthy();
      expect(
        screen.queryByText(i18n.t('translations:piece_rate_pay')),
      ).toBeNull();

      // 2. Shows "Paid on", not "Delivered on"
      expect(
        screen.getByText(i18n.t('translations:earnings_paid_on')),
      ).toBeTruthy();
      expect(
        screen.queryByText(i18n.t('translations:delivered_on')),
      ).toBeNull();

      // 3. Shows no "Delivered to" row or dropoff address
      expect(
        screen.queryByText(i18n.t('translations:delivered_to')),
      ).toBeNull();
      expect(screen.queryByText('Dimitriadis 25, Volos')).toBeNull();

      // 4. Pickup business is still shown
      expect(screen.getByText('Souvlaki Express')).toBeTruthy();
    });

    it('normal delivery is unchanged: labels amount Piece-rate pay, shows Delivered to, and shows Delivered on', () => {
      const normalDeliveryDetail: EarningsDeliveryDetail = {
        ...mockDeliveryDetail,
        kind: undefined,
      };

      (useEarningsDelivery as jest.Mock).mockReturnValue({
        delivery: normalDeliveryDetail,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      // 1. Labels the compensation amount "Piece-rate pay"
      expect(
        screen.getByText(i18n.t('translations:piece_rate_pay')),
      ).toBeTruthy();

      // 2. Shows "Delivered to" and the dropoff address
      expect(
        screen.getByText(i18n.t('translations:delivered_to')),
      ).toBeTruthy();
      expect(screen.getByText('Dimitriadis 25, Volos')).toBeTruthy();

      // 3. Shows "Delivered on", not "Paid on"
      expect(
        screen.getByText(i18n.t('translations:delivered_on')),
      ).toBeTruthy();
      expect(
        screen.queryByText(i18n.t('translations:earnings_paid_on')),
      ).toBeNull();
    });
  });
});

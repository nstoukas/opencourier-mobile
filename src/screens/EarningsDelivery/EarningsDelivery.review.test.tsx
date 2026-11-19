import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { EarningsDelivery } from './EarningsDelivery';
import { useEarningsDelivery } from '@app/hooks/useEarningsDelivery';
import { EarningsDeliveryDetail } from '@app/types/types';
import { MainScreens } from '@app/navigation/main/types';

jest.mock('@app/hooks/useEarningsDelivery');

describe('EarningsDelivery review button and correction (spec 0038, AC-1, AC-7, AC-10)', () => {
  const mockNavigation: any = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  const defaultProps: any = {
    navigation: mockNavigation,
    route: { params: { deliveryId: 'del-101' } },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Ask for a review button (AC-1)', () => {
    it('shows "Ask for a review" button and navigates to RequestReview with delivery details', () => {
      const delivery: EarningsDeliveryDetail = {
        deliveryId: 'del-101',
        pickupBusinessName: 'Pizza Bistro',
        dropoffAddress: 'Iasonos 40, Volos',
        droppedOffAt: '2026-11-19T14:00:00Z',
        compensation: 250,
        tips: 50,
        total: 300,
        currency: 'EUR',
      };

      (useEarningsDelivery as jest.Mock).mockReturnValue({
        delivery,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:review_from_delivery_hint')),
      ).toBeTruthy();

      const askButton = screen.getByText(i18n.t('translations:review_ask'));
      fireEvent.press(askButton);

      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        MainScreens.RequestReview,
        {
          deliveryId: 'del-101',
          deliveryLabel: expect.stringContaining('Pizza Bistro'),
        },
      );
    });
  });

  describe('reviewPay line in pay breakdown (AC-7, AC-10)', () => {
    it('shows reviewPay as a separate line with "Review correction" label in delivery currency', () => {
      const deliveryWithReviewPay: EarningsDeliveryDetail = {
        deliveryId: 'del-reviewed',
        pickupBusinessName: 'Souvlaki Bar',
        dropoffAddress: 'Dimitriadis 12, Volos',
        droppedOffAt: '2026-11-19T12:00:00Z',
        compensation: 250,
        tips: 0,
        reviewPay: 150, // €1.50 pay correction
        total: 400,
        currency: 'EUR',
      };

      (useEarningsDelivery as jest.Mock).mockReturnValue({
        delivery: deliveryWithReviewPay,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:earnings_review_correction')),
      ).toBeTruthy();
      expect(screen.getByText('€1.50')).toBeTruthy();
    });

    it('formats reviewPay in non-EUR currency (never assumed EUR)', () => {
      const deliveryWithUsdReviewPay: EarningsDeliveryDetail = {
        deliveryId: 'del-usd-review',
        pickupBusinessName: 'Burger Joint',
        dropoffAddress: 'Broadway 100',
        droppedOffAt: '2026-11-19T13:00:00Z',
        compensation: 300,
        tips: 0,
        reviewPay: 200,
        total: 500,
        currency: 'USD',
      };

      (useEarningsDelivery as jest.Mock).mockReturnValue({
        delivery: deliveryWithUsdReviewPay,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      expect(screen.getByText('US$2.00')).toBeTruthy();
      expect(screen.queryByText('€2.00')).toBeNull();
    });

    it('hides reviewPay line when reviewPay is undefined', () => {
      const ordinaryDelivery: EarningsDeliveryDetail = {
        deliveryId: 'del-plain',
        pickupBusinessName: 'Mega Grill',
        dropoffAddress: 'Ermou 15, Volos',
        droppedOffAt: '2026-11-19T15:00:00Z',
        compensation: 250,
        tips: 50,
        total: 300,
        currency: 'EUR',
      };

      (useEarningsDelivery as jest.Mock).mockReturnValue({
        delivery: ordinaryDelivery,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      expect(
        screen.queryByText(i18n.t('translations:earnings_review_correction')),
      ).toBeNull();
    });
  });

  describe('delivery kind REVIEW_CORRECTION (AC-7)', () => {
    it('shows "Review correction" as the main compensation label for REVIEW_CORRECTION deliveries', () => {
      const reviewOnlyDelivery: EarningsDeliveryDetail = {
        deliveryId: 'del-review-only',
        pickupBusinessName: 'Bakery Corner',
        dropoffAddress: 'Anapafseos 5, Volos',
        droppedOffAt: '2026-11-19T16:00:00Z',
        compensation: 150,
        tips: 0,
        total: 150,
        currency: 'EUR',
        kind: 'REVIEW_CORRECTION',
      };

      (useEarningsDelivery as jest.Mock).mockReturnValue({
        delivery: reviewOnlyDelivery,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:earnings_review_correction')),
      ).toBeTruthy();
      // Should show Paid on instead of Delivered on
      expect(
        screen.getByText(i18n.t('translations:earnings_paid_on')),
      ).toBeTruthy();
    });
  });
});

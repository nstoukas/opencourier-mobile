import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Earnings } from './Earnings';
import { useEarnings } from '@app/hooks/useEarnings';
import i18n from '@app/localization/i18n';

jest.mock('@app/hooks/useEarnings');

describe('Earnings summary (row 112, decision 112.1)', () => {
  const mockNavigation: any = {
    toggleDrawer: jest.fn(),
    navigate: jest.fn(),
  };

  const defaultProps: any = {
    navigation: mockNavigation,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('with deliveryCount 0 and totalEarnings > 0', () => {
    const baseMockEarnings = {
      days: [],
      totalEarnings: 250,
      totalCompensation: 250,
      totalTips: 0,
      deliveryCount: 0,
      currency: 'EUR',
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    };

    it('on Today tab: header says "Paid for other work, no deliveries" (never "No Orders Today") and pay and tips line shows', () => {
      (useEarnings as jest.Mock).mockReturnValue(baseMockEarnings);

      render(<Earnings {...defaultProps} />);

      // Header says "Paid for other work, no deliveries"
      expect(
        screen.getByText(
          i18n.t('translations:earnings_paid_without_deliveries'),
        ),
      ).toBeTruthy();

      // Never "No Orders Today"
      expect(
        screen.queryByText(i18n.t('translations:no_orders_today')),
      ).toBeNull();

      // Pay and tips line shows
      expect(
        screen.getByText(
          i18n.t('translations:pay_tips_breakdown', {
            pay: '€2.50',
            tips: '€0.00',
          }),
        ),
      ).toBeTruthy();
    });

    it('on Weekly tab: header says "Paid for other work, no deliveries" (never "No Orders This Week") and pay and tips line shows', () => {
      (useEarnings as jest.Mock).mockReturnValue(baseMockEarnings);

      render(<Earnings {...defaultProps} />);

      fireEvent.press(screen.getByText(i18n.t('translations:weekly')));

      expect(
        screen.getByText(
          i18n.t('translations:earnings_paid_without_deliveries'),
        ),
      ).toBeTruthy();
      expect(
        screen.queryByText(i18n.t('translations:no_orders_this_week')),
      ).toBeNull();
      expect(
        screen.getByText(
          i18n.t('translations:pay_tips_breakdown', {
            pay: '€2.50',
            tips: '€0.00',
          }),
        ),
      ).toBeTruthy();
    });

    it('on All tab: header says "Paid for other work, no deliveries" (never "No Orders") and pay and tips line shows', () => {
      (useEarnings as jest.Mock).mockReturnValue(baseMockEarnings);

      render(<Earnings {...defaultProps} />);

      fireEvent.press(screen.getByText(i18n.t('translations:all')));

      expect(
        screen.getByText(
          i18n.t('translations:earnings_paid_without_deliveries'),
        ),
      ).toBeTruthy();
      expect(screen.queryByText(i18n.t('translations:no_orders'))).toBeNull();
      expect(
        screen.getByText(
          i18n.t('translations:pay_tips_breakdown', {
            pay: '€2.50',
            tips: '€0.00',
          }),
        ),
      ).toBeTruthy();
    });
  });

  describe('with deliveryCount 0 and totalEarnings 0', () => {
    const zeroMockEarnings = {
      days: [],
      totalEarnings: 0,
      totalCompensation: 0,
      totalTips: 0,
      deliveryCount: 0,
      currency: 'EUR',
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    };

    it('on Today tab: header says "No Orders Today" and breakdown line is hidden', () => {
      (useEarnings as jest.Mock).mockReturnValue(zeroMockEarnings);

      render(<Earnings {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:no_orders_today')),
      ).toBeTruthy();
      expect(
        screen.queryByText(
          i18n.t('translations:earnings_paid_without_deliveries'),
        ),
      ).toBeNull();
      expect(
        screen.queryByText(
          i18n.t('translations:pay_tips_breakdown', {
            pay: '€0.00',
            tips: '€0.00',
          }),
        ),
      ).toBeNull();
    });

    it('on Weekly tab: header says "No Orders This Week" and breakdown line is hidden', () => {
      (useEarnings as jest.Mock).mockReturnValue(zeroMockEarnings);

      render(<Earnings {...defaultProps} />);

      fireEvent.press(screen.getByText(i18n.t('translations:weekly')));

      expect(
        screen.getByText(i18n.t('translations:no_orders_this_week')),
      ).toBeTruthy();
      expect(
        screen.queryByText(
          i18n.t('translations:earnings_paid_without_deliveries'),
        ),
      ).toBeNull();
      expect(
        screen.queryByText(
          i18n.t('translations:pay_tips_breakdown', {
            pay: '€0.00',
            tips: '€0.00',
          }),
        ),
      ).toBeNull();
    });

    it('on All tab: header says "No Orders" and breakdown line is hidden', () => {
      (useEarnings as jest.Mock).mockReturnValue(zeroMockEarnings);

      render(<Earnings {...defaultProps} />);

      fireEvent.press(screen.getByText(i18n.t('translations:all')));

      expect(screen.getByText(i18n.t('translations:no_orders'))).toBeTruthy();
      expect(
        screen.queryByText(
          i18n.t('translations:earnings_paid_without_deliveries'),
        ),
      ).toBeNull();
      expect(
        screen.queryByText(
          i18n.t('translations:pay_tips_breakdown', {
            pay: '€0.00',
            tips: '€0.00',
          }),
        ),
      ).toBeNull();
    });
  });

  describe('with deliveries (deliveryCount > 0)', () => {
    it('says "<n> orders" and shows the pay and tips breakdown line', () => {
      (useEarnings as jest.Mock).mockReturnValue({
        days: [],
        totalEarnings: 850,
        totalCompensation: 700,
        totalTips: 150,
        deliveryCount: 3,
        currency: 'EUR',
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<Earnings {...defaultProps} />);

      expect(
        screen.getByText(`3 ${i18n.t('translations:orders_small')}`),
      ).toBeTruthy();
      expect(
        screen.getByText(
          i18n.t('translations:pay_tips_breakdown', {
            pay: '€7.00',
            tips: '€1.50',
          }),
        ),
      ).toBeTruthy();
    });

    it('says "1 orders" when deliveryCount is 1 and shows the pay and tips breakdown line', () => {
      (useEarnings as jest.Mock).mockReturnValue({
        days: [],
        totalEarnings: 350,
        totalCompensation: 300,
        totalTips: 50,
        deliveryCount: 1,
        currency: 'EUR',
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<Earnings {...defaultProps} />);

      expect(
        screen.getByText(`1 ${i18n.t('translations:orders_small')}`),
      ).toBeTruthy();
      expect(
        screen.getByText(
          i18n.t('translations:pay_tips_breakdown', {
            pay: '€3.00',
            tips: '€0.50',
          }),
        ),
      ).toBeTruthy();
    });
  });
});

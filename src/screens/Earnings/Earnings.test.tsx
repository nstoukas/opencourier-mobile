import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { Earnings } from './Earnings';
import { useEarnings } from '@app/hooks/useEarnings';
import { useReviewRequests } from '@app/hooks/useReviewRequests';
import { useReviewSeen } from '@app/services/reviewSeen';
import { queryClient } from '@app/services/queryClient';
import { QueryKeys } from '@app/utilities/queryKeys';
import { MainScreens } from '@app/navigation/main/types';
import { EarningsSummaryDay } from '@app/types/types';
import i18n from '@app/localization/i18n';

jest.mock('@app/hooks/useEarnings');
jest.mock('@app/hooks/useReviewRequests', () => ({
  useReviewRequests: jest.fn(() => ({ data: { pages: [] } })),
}));
jest.mock('@app/services/reviewSeen', () => ({
  useReviewSeen: jest.fn(() => []),
}));
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      addListener: jest.fn(() => jest.fn()),
    }),
  };
});
const mockRefetchPages = jest.fn();
const mockRefetchCoop = jest.fn();
const sampleShift = {
  startedAt: '2026-11-20T10:00:00.000Z',
  startedBeforeRange: false,
  endedAt: '2026-11-20T13:12:00.000Z',
  onBreakSince: null,
  workSeconds: 11520,
  jobSeconds: 7200,
  paidWaitSeconds: 720,
  unpaidSeconds: 3600,
  breaks: [],
  moneyCents: 3850,
  lateMoneyCents: 0,
  centsPerHour: 1203,
  currencyCode: 'EUR',
  statusChanges: [
    {
      at: '2026-11-20T10:00:00.000Z',
      fromStatus: 'OFFLINE',
      toStatus: 'ONLINE',
      cause: 'RIDER',
      byAdmin: false,
    },
  ],
  jobs: [],
};

jest.mock('@app/hooks/useTimeWorked', () => ({
  useTimeWorkedPages: jest.fn(() => ({
    data: {
      pages: [
        {
          recordedFrom: '2026-11-19T00:00:00.000Z',
          currencyCode: 'EUR',
          days: [
            {
              date: '2026-11-20',
              workSeconds: 11520,
              jobSeconds: 7200,
              paidWaitSeconds: 720,
              unpaidSeconds: 3600,
              moneyCents: 3850,
              centsPerHour: 1203,
              unlinkedMoneyCents: 0,
            },
          ],
          shifts: [sampleShift],
        },
      ],
    },
    isLoading: false,
    isError: false,
    hasNextPage: false,
    fetchNextPage: jest.fn(),
    refetch: mockRefetchPages,
  })),
  useCoopTotals: jest.fn(() => ({
    data: null,
    isLoading: false,
    isError: false,
    refetch: mockRefetchCoop,
  })),
}));

describe('Earnings summary (row 112, decision 112.1)', () => {
  const mockNavigation: any = {
    toggleDrawer: jest.fn(),
    navigate: jest.fn(),
    // The screen asks for the review list again on focus (row 30 review); nothing to check here.
    addListener: jest.fn(() => jest.fn()),
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

  describe('day rows in summary list (row 112 review)', () => {
    it('a day row with deliveryCount 0 and total > 0 reads "Paid for other work, no deliveries", with 1 delivery reads "1 delivery", and with 3 reads "3 deliveries"', () => {
      const days: EarningsSummaryDay[] = [
        {
          date: '2026-11-18',
          deliveryCount: 0,
          compensation: 200,
          tips: 0,
          total: 200,
        },
        {
          date: '2026-11-17',
          deliveryCount: 1,
          compensation: 300,
          tips: 50,
          total: 350,
        },
        {
          date: '2026-11-16',
          deliveryCount: 3,
          compensation: 900,
          tips: 150,
          total: 1050,
        },
      ];

      (useEarnings as jest.Mock).mockReturnValue({
        days,
        totalEarnings: 1600,
        totalCompensation: 1400,
        totalTips: 200,
        deliveryCount: 4,
        currency: 'EUR',
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<Earnings {...defaultProps} />);

      // A day row with deliveryCount 0 and total > 0 reads "Paid for other work, no deliveries"
      expect(
        screen.getByText(
          new RegExp(
            `· ${i18n.t('translations:earnings_paid_without_deliveries')}`,
          ),
        ),
      ).toBeTruthy();

      // Does not say "0 deliveries"
      expect(
        screen.queryByText(
          new RegExp(`· 0 ${i18n.t('translations:deliveries_small')}`),
        ),
      ).toBeNull();

      // A day with 1 delivery reads "1 delivery"
      expect(
        screen.getByText(
          new RegExp(`· 1 ${i18n.t('translations:delivery_small')}`),
        ),
      ).toBeTruthy();

      // A day with 3 reads "3 deliveries"
      expect(
        screen.getByText(
          new RegExp(`· 3 ${i18n.t('translations:deliveries_small')}`),
        ),
      ).toBeTruthy();

      // Formatted day amounts are shown
      expect(screen.getByText('€2.00')).toBeTruthy();
      expect(screen.getByText('€3.50')).toBeTruthy();
      expect(screen.getByText('€10.50')).toBeTruthy();
    });

    it('a day row with deliveryCount 0 and total 0 reads "0 deliveries"', () => {
      const days: EarningsSummaryDay[] = [
        {
          date: '2026-11-18',
          deliveryCount: 0,
          compensation: 0,
          tips: 0,
          total: 0,
        },
      ];

      (useEarnings as jest.Mock).mockReturnValue({
        days,
        totalEarnings: 0,
        totalCompensation: 0,
        totalTips: 0,
        deliveryCount: 0,
        currency: 'EUR',
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<Earnings {...defaultProps} />);

      expect(
        screen.getByText(
          new RegExp(`· 0 ${i18n.t('translations:deliveries_small')}`),
        ),
      ).toBeTruthy();
      expect(
        screen.queryByText(
          new RegExp(
            `· ${i18n.t('translations:earnings_paid_without_deliveries')}`,
          ),
        ),
      ).toBeNull();
    });
  });

  describe('How offers and pay work link and New answer mark (spec 0038, AC-9, AC-11)', () => {
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

    it('renders "How offers and pay work" link and navigates to HowItWorks on press', () => {
      (useEarnings as jest.Mock).mockReturnValue(baseMockEarnings);

      render(<Earnings {...defaultProps} />);

      const howLink = screen.getByTestId('how-it-works-link');
      expect(howLink).toBeTruthy();
      expect(screen.getByText(i18n.t('translations:how_title'))).toBeTruthy();

      fireEvent.press(howLink);
      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        MainScreens.HowItWorks,
      );
    });

    it('shows "New answer" badge when there is an answered review request not yet in seenAnswers', () => {
      (useEarnings as jest.Mock).mockReturnValue(baseMockEarnings);
      (useReviewRequests as jest.Mock).mockReturnValue({
        data: {
          pages: [
            {
              data: [{ id: 'rev-answered-1', status: 'ANSWERED' }],
            },
          ],
        },
      });
      // Not seen yet
      (useReviewSeen as jest.Mock).mockReturnValue([]);

      render(<Earnings {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:review_new_answer')),
      ).toBeTruthy();
    });

    it('hides "New answer" badge when answered review request is already in seenAnswers', () => {
      (useEarnings as jest.Mock).mockReturnValue(baseMockEarnings);
      (useReviewRequests as jest.Mock).mockReturnValue({
        data: {
          pages: [
            {
              data: [{ id: 'rev-answered-1', status: 'ANSWERED' }],
            },
          ],
        },
      });
      // Already seen
      (useReviewSeen as jest.Mock).mockReturnValue(['rev-answered-1']);

      render(<Earnings {...defaultProps} />);

      expect(
        screen.queryByText(i18n.t('translations:review_new_answer')),
      ).toBeNull();
    });
  });

  describe('Review requests refreshed on focus (spec 0038, AC-9, row 30 review)', () => {
    it('invalidates reviewRequests when the screen gets focus', () => {
      let focusCallback: (() => void) | undefined;
      const unsubscribe = jest.fn();
      const nav: any = {
        toggleDrawer: jest.fn(),
        navigate: jest.fn(),
        addListener: jest.fn((event: string, cb: () => void) => {
          if (event === 'focus') {
            focusCallback = cb;
          }
          return unsubscribe;
        }),
      };

      (useEarnings as jest.Mock).mockReturnValue({
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
      });

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { unmount } = render(
        <Earnings {...defaultProps} navigation={nav} />,
      );

      expect(nav.addListener).toHaveBeenCalledWith(
        'focus',
        expect.any(Function),
      );
      expect(focusCallback).toBeDefined();

      act(() => {
        focusCallback!();
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.reviewRequests],
      });

      unmount();
      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('TimeWorkedSection footer persistence across re-renders (review 2026-11-20)', () => {
    it('does not unmount TimeWorkedSection on re-render (opened shift stays open)', () => {
      (useEarnings as jest.Mock).mockReturnValue({
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
      });

      render(<Earnings {...defaultProps} />);

      // Find the shift in the footer
      const shiftButton = screen.getByTestId('time-worked-shift');
      expect(shiftButton.props.accessibilityState.expanded).toBe(false);

      // Open the shift
      fireEvent.press(shiftButton);
      expect(shiftButton.props.accessibilityState.expanded).toBe(true);
      expect(
        screen.getByText(i18n.t('translations:time_worked_details_status')),
      ).toBeTruthy();

      // Trigger a re-render of Earnings by switching tabs to Weekly
      fireEvent.press(screen.getByText(i18n.t('translations:weekly')));

      // With ListFooterComponent={renderFooter()}, the section stays mounted so the shift remains open.
      // If ListFooterComponent={renderFooter} were used, FlatList would treat the new function reference
      // as a new component type and remount TimeWorkedSection, closing the shift.
      const shiftButtonAfterTabChange = screen.getByTestId('time-worked-shift');
      expect(shiftButtonAfterTabChange.props.accessibilityState.expanded).toBe(
        true,
      );
      expect(
        screen.getByText(i18n.t('translations:time_worked_details_status')),
      ).toBeTruthy();
    });
  });
});

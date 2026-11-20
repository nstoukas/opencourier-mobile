import React from 'react';
import { RefreshControl } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { AxiosError } from 'axios';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { EarningsDelivery } from './EarningsDelivery';
import { useEarningsDelivery } from '@app/hooks/useEarnings';
import { MainScreens } from '@app/navigation/main/types';
import { EarningsDeliveryDetail } from '@app/types/earnings';

jest.mock('@app/hooks/useEarnings', () => {
  const actual = jest.requireActual('@app/hooks/useEarnings');
  return {
    ...actual,
    useEarningsDelivery: jest.fn(),
  };
});

describe('EarningsDelivery (spec 0042, AC-10, AC-11, AC-13)', () => {
  const mockNavigation: any = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  const defaultProps: any = {
    navigation: mockNavigation,
    route: { params: { deliveryId: 'del-123' } },
  };

  const sampleDelivery: EarningsDeliveryDetail = {
    deliveryId: 'del-123',
    currencyCode: 'EUR',
    pickupName: 'Souvlaki Bar',
    dropoffArea: 'Dimitriadis',
    paidKm: 2.5,
    jobs: [
      {
        acceptedAt: '2026-11-20T12:00:00.000Z',
        endedAt: '2026-11-20T12:20:00.000Z',
        endLabel: null, // Delivered
        minutes: 20,
        pickupWaitSeconds: 120, // 2 min
      },
    ],
    breakdown: {
      baseFeeCents: 200,
      distanceFeeCents: 150,
      deliveryPayCents: 350,
      tipsCents: 100,
      compensations: [
        {
          reason: 'WAITING',
          amountCents: 80,
          waitMinutes: 5,
          createdAt: '2026-11-20T12:10:00.000Z',
          addedLater: false,
        },
        {
          reason: 'REVIEW',
          amountCents: 50,
          waitMinutes: null,
          createdAt: '2026-11-21T10:00:00.000Z',
          addedLater: true,
        },
      ],
      totalCents: 580,
    },
    timeline: [
      {
        type: 'ACCEPTED',
        at: '2026-11-20T12:00:00.000Z',
        who: 'YOU',
        anotherRider: false,
      },
      {
        type: 'ARRIVED_AT_PICKUP_LOCATION',
        at: '2026-11-20T12:08:00.000Z',
        who: 'YOU',
        anotherRider: false,
      },
      {
        type: 'FOOD_READY',
        at: '2026-11-20T12:10:00.000Z',
        who: 'RESTAURANT',
        anotherRider: false,
      },
      {
        type: 'PICKED_UP',
        at: '2026-11-20T12:10:00.000Z',
        who: 'YOU',
        anotherRider: false,
      },
      {
        type: 'DISPATCH_CALL',
        at: '2026-11-20T12:15:00.000Z',
        who: 'DISPATCH',
        anotherRider: false,
      },
      {
        type: 'SYSTEM_EVENT',
        at: '2026-11-20T12:16:00.000Z',
        who: 'SYSTEM',
        anotherRider: false,
      },
      {
        type: 'DROPPED_OFF',
        at: '2026-11-20T12:20:00.000Z',
        who: 'YOU',
        anotherRider: false,
      },
      {
        type: 'ACCEPTED',
        at: '2026-11-20T11:50:00.000Z',
        who: null,
        anotherRider: true,
      },
      {
        type: 'SOME_NEW_FUTURE_EVENT_TYPE',
        at: '2026-11-20T12:25:00.000Z',
        who: null,
        anotherRider: false,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Pay breakdown (AC-10)', () => {
    it('shows base fee and distance fee when both are present and not null', () => {
      (useEarningsDelivery as jest.Mock).mockReturnValue({
        data: sampleDelivery,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:earnings_base_fee')),
      ).toBeTruthy();
      expect(screen.getByText('€2.00')).toBeTruthy();

      expect(
        screen.getByText(i18n.t('translations:earnings_distance_fee')),
      ).toBeTruthy();
      expect(screen.getByText('€1.50')).toBeTruthy();

      // Does not show single Delivery pay line
      expect(
        screen.queryByText(i18n.t('translations:earnings_delivery_pay')),
      ).toBeNull();
    });

    it('shows one "Delivery pay" line when baseFeeCents or distanceFeeCents is null', () => {
      const deliveryWithNullBase: EarningsDeliveryDetail = {
        ...sampleDelivery,
        breakdown: {
          ...sampleDelivery.breakdown,
          baseFeeCents: null,
          distanceFeeCents: null,
          deliveryPayCents: 350,
        },
      };

      (useEarningsDelivery as jest.Mock).mockReturnValue({
        data: deliveryWithNullBase,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:earnings_delivery_pay')),
      ).toBeTruthy();
      expect(screen.getByText('€3.50')).toBeTruthy();
      expect(
        screen.queryByText(i18n.t('translations:earnings_base_fee')),
      ).toBeNull();
      expect(
        screen.queryByText(i18n.t('translations:earnings_distance_fee')),
      ).toBeNull();
    });

    it('shows tips, compensations with minutes, and "added later on <day>" for late payments', () => {
      (useEarningsDelivery as jest.Mock).mockReturnValue({
        data: sampleDelivery,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      // Tips
      expect(screen.getByText(i18n.t('translations:tips'))).toBeTruthy();
      expect(screen.getByText('€1.00')).toBeTruthy();

      // Waiting with minutes
      expect(
        screen.getByText(
          i18n.t('translations:earnings_reason_minutes', {
            reason: i18n.t('translations:earnings_waiting'),
            minutes: 5,
          }),
        ),
      ).toBeTruthy();
      expect(screen.getByText('€0.80')).toBeTruthy();

      // Added later compensation
      expect(
        screen.getByText(
          i18n.t('translations:earnings_added_later', {
            what: i18n.t('translations:earnings_review_correction'),
            day: '21 Nov',
          }),
        ),
      ).toBeTruthy();
      expect(screen.getByText('€0.50')).toBeTruthy();

      // Total money
      expect(
        screen.getByText(i18n.t('translations:total_earned')),
      ).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:earnings_total')),
      ).toBeTruthy();
      expect(screen.getAllByText('€5.80')).toHaveLength(2); // In total card and in breakdown
    });

    it('shows pickup business, dropoff area ("—" if null), paid km, delivery id, and rider job holds', () => {
      (useEarningsDelivery as jest.Mock).mockReturnValue({
        data: sampleDelivery,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      expect(screen.getByText('Souvlaki Bar')).toBeTruthy();
      expect(screen.getByText('Dimitriadis')).toBeTruthy();
      expect(screen.getByText('2.5 km')).toBeTruthy();
      expect(screen.getByText('del-123')).toBeTruthy();

      // Rider job line
      expect(
        screen.getByText('20 min · pickup wait 2 min · Delivered'),
      ).toBeTruthy();
    });

    it('shows "—" when dropoffArea is null', () => {
      const deliveryNullArea: EarningsDeliveryDetail = {
        ...sampleDelivery,
        dropoffArea: null,
      };

      (useEarningsDelivery as jest.Mock).mockReturnValue({
        data: deliveryNullArea,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      expect(screen.getByText('—')).toBeTruthy();
    });
  });

  describe('Timeline (AC-11)', () => {
    it('lists timeline events with tap time, who acted, another rider, and falls back to Update for unknown types', () => {
      (useEarningsDelivery as jest.Mock).mockReturnValue({
        data: sampleDelivery,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:earnings_timeline')),
      ).toBeTruthy();

      const lines = screen.getAllByTestId('earnings-timeline-line');
      expect(lines.length).toBe(sampleDelivery.timeline.length);

      // "You" actor
      expect(screen.getByText('Accepted · You')).toBeTruthy();

      // "Restaurant" actor
      expect(
        screen.getByText('Restaurant marked the food ready · Restaurant'),
      ).toBeTruthy();

      // "Dispatch" actor
      expect(screen.getByText('Update · Dispatch')).toBeTruthy();

      // "System" actor
      expect(screen.getByText('Update · System')).toBeTruthy();

      // "Another rider took it"
      expect(
        screen.getByText(i18n.t('translations:earnings_event_another_rider')),
      ).toBeTruthy();

      // Unknown event type falls back to "Update"
      expect(
        screen.getByText(i18n.t('translations:earnings_event_update')),
      ).toBeTruthy();
    });

    it('shows "D MMM, HH:mm" on another Athens day than line before, clock only on same day, and first line shows day when differing from first job accept day (AC-11)', () => {
      // First job accepted on 2026-11-20T12:00:00Z (Athens day: 20 Nov)
      const deliveryWithMultiDayTimeline: EarningsDeliveryDetail = {
        ...sampleDelivery,
        jobs: [
          {
            acceptedAt: '2026-11-20T12:00:00.000Z',
            endedAt: '2026-11-20T12:20:00.000Z',
            endLabel: null,
            minutes: 20,
            pickupWaitSeconds: 120,
          },
        ],
        timeline: [
          // Line 0: same day as firstJob.acceptedAt (20 Nov) -> clock only
          {
            type: 'ACCEPTED',
            at: '2026-11-20T12:05:00.000Z', // 14:05 Athens
            who: 'YOU',
            anotherRider: false,
          },
          // Line 1: same day as line 0 (20 Nov) -> clock only
          {
            type: 'PICKED_UP',
            at: '2026-11-20T12:15:00.000Z', // 14:15 Athens
            who: 'YOU',
            anotherRider: false,
          },
          // Line 2: another Athens day than line 1 (23 Nov !== 20 Nov) -> "D MMM, HH:mm"
          {
            type: 'REVIEW',
            at: '2026-11-23T09:30:00.000Z', // 11:30 Athens
            who: 'DISPATCH',
            anotherRider: false,
          },
          // Line 3: same day as line 2 (23 Nov) -> clock only
          {
            type: 'DROPPED_OFF',
            at: '2026-11-23T10:00:00.000Z', // 12:00 Athens
            who: 'YOU',
            anotherRider: false,
          },
        ],
      };

      (useEarningsDelivery as jest.Mock).mockReturnValue({
        data: deliveryWithMultiDayTimeline,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      // Line 0 (same day as accept): clock only
      expect(screen.getByText('14:05')).toBeTruthy();
      expect(screen.queryByText('20 Nov, 14:05')).toBeNull();

      // Line 1 (same day as line 0): clock only
      expect(screen.getByText('14:15')).toBeTruthy();

      // Line 2 (another day than line 1): "D MMM, HH:mm"
      expect(screen.getByText('23 Nov, 11:30')).toBeTruthy();

      // Line 3 (same day as line 2): clock only
      expect(screen.getByText('12:00')).toBeTruthy();
      expect(screen.queryByText('23 Nov, 12:00')).toBeNull();
    });

    it('first timeline line shows its day when it is not the first job accept day (AC-11)', () => {
      // First job accepted on 2026-11-19T21:00:00Z (Athens: 23:00 Nov 19)
      // First timeline event at 2026-11-20T00:30:00Z (Athens: 02:30 Nov 20)
      const deliveryWithLateEvent: EarningsDeliveryDetail = {
        ...sampleDelivery,
        jobs: [
          {
            acceptedAt: '2026-11-19T21:00:00.000Z',
            endedAt: '2026-11-20T01:00:00.000Z',
            endLabel: null,
            minutes: 120,
            pickupWaitSeconds: 120,
          },
        ],
        timeline: [
          {
            type: 'PICKED_UP',
            at: '2026-11-20T00:30:00.000Z', // 02:30 Athens Nov 20
            who: 'YOU',
            anotherRider: false,
          },
        ],
      };

      (useEarningsDelivery as jest.Mock).mockReturnValue({
        data: deliveryWithLateEvent,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      // First line differs from firstJob accept day (20 Nov vs 19 Nov): shows "D MMM, HH:mm"
      expect(screen.getByText('20 Nov, 02:30')).toBeTruthy();
    });
  });

  describe('Review button navigation (AC-10)', () => {
    it('navigates to RequestReview with deliveryId and pickupName label', () => {
      (useEarningsDelivery as jest.Mock).mockReturnValue({
        data: sampleDelivery,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      const reviewButton = screen.getByText(i18n.t('translations:review_ask'));
      fireEvent.press(reviewButton);

      expect(mockNavigation.navigate).toHaveBeenCalledWith(
        MainScreens.RequestReview,
        {
          deliveryId: 'del-123',
          deliveryLabel: 'Souvlaki Bar, 20 Nov',
        },
      );
    });
  });

  describe('Back navigation button', () => {
    it('calls navigation.goBack() when back button is pressed', () => {
      (useEarningsDelivery as jest.Mock).mockReturnValue({
        data: sampleDelivery,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      const backNav = screen.getByTestId(
        'phosphor-react-native-arrow-left-bold',
      );
      fireEvent.press(backNav);

      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Offline and error states (AC-10, AC-13)', () => {
    it('shows "No connection" and needs connection text (not "Delivery not found") when network error with no response', () => {
      const networkError = new AxiosError('Network Error', 'ERR_NETWORK');
      (useEarningsDelivery as jest.Mock).mockReturnValue({
        data: null,
        error: networkError,
        isLoading: false,
        isError: true,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:earnings_no_connection')),
      ).toBeTruthy();
      expect(
        screen.getByText(
          i18n.t('translations:earnings_detail_needs_connection'),
        ),
      ).toBeTruthy();
      expect(
        screen.queryByText(i18n.t('translations:delivery_not_found')),
      ).toBeNull();
    });

    it('shows "Delivery not found" and 2 months sentence when server answers 404', () => {
      const notFoundError = new AxiosError(
        'Not Found',
        'ERR_BAD_REQUEST',
        undefined,
        undefined,
        { status: 404 } as any,
      );
      (useEarningsDelivery as jest.Mock).mockReturnValue({
        data: null,
        error: notFoundError,
        isLoading: false,
        isError: true,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:delivery_not_found')),
      ).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:earnings_detail_not_found')),
      ).toBeTruthy();
    });

    it('shows "Could not load this job" and pull down to retry when server answers 500', () => {
      const serverError = new AxiosError(
        'Internal Server Error',
        'ERR_BAD_RESPONSE',
        undefined,
        undefined,
        { status: 500 } as any,
      );
      (useEarningsDelivery as jest.Mock).mockReturnValue({
        data: null,
        error: serverError,
        isLoading: false,
        isError: true,
        isRefetching: false,
        refetch: jest.fn(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      expect(
        screen.getByText(i18n.t('translations:earnings_detail_could_not_load')),
      ).toBeTruthy();
      expect(
        screen.getByText(i18n.t('translations:earnings_pull_to_retry')),
      ).toBeTruthy();
    });

    it('shows "No connection. As of <time>" when refetch fails over cached data', () => {
      const updatedAt = Date.parse('2026-11-20T11:46:00.000Z');
      const networkError = new AxiosError('Network Error', 'ERR_NETWORK');
      (useEarningsDelivery as jest.Mock).mockReturnValue({
        data: sampleDelivery,
        error: networkError,
        isLoading: false,
        isError: true,
        isRefetching: false,
        refetch: jest.fn(),
        dataUpdatedAt: updatedAt,
      });

      render(<EarningsDelivery {...defaultProps} />);

      expect(screen.getByTestId('earnings-as-of')).toBeTruthy();
      expect(
        screen.getByText(
          i18n.t('translations:earnings_as_of', { time: '13:46' }),
        ),
      ).toBeTruthy();

      // Screen still shows the cached delivery details!
      expect(screen.getByText('Souvlaki Bar')).toBeTruthy();
      expect(screen.getAllByText('€5.80').length).toBeGreaterThanOrEqual(1);
    });

    it('shows "No connection. As of <time>." on first failed try (isError: false, failureCount: 1, network error)', () => {
      const updatedAt = Date.parse('2026-11-20T11:46:00.000Z');
      const networkError = new AxiosError('Network Error', 'ERR_NETWORK');
      (useEarningsDelivery as jest.Mock).mockReturnValue({
        data: sampleDelivery,
        error: undefined,
        failureReason: networkError,
        failureCount: 1,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
        dataUpdatedAt: updatedAt,
      });

      render(<EarningsDelivery {...defaultProps} />);

      expect(screen.getByTestId('earnings-as-of')).toBeTruthy();
      expect(
        screen.getByText(
          i18n.t('translations:earnings_as_of', { time: '13:46' }),
        ),
      ).toBeTruthy();
    });

    it('shows "Could not refresh. As of <time>." when server answered 500 (isError: false, failureCount: 1)', () => {
      const updatedAt = Date.parse('2026-11-20T11:46:00.000Z');
      const serverError = new AxiosError(
        'Internal Server Error',
        'ERR_BAD_RESPONSE',
        undefined,
        undefined,
        { status: 500 } as any,
      );
      (useEarningsDelivery as jest.Mock).mockReturnValue({
        data: sampleDelivery,
        error: undefined,
        failureReason: serverError,
        failureCount: 1,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
        dataUpdatedAt: updatedAt,
      });

      render(<EarningsDelivery {...defaultProps} />);

      expect(screen.getByTestId('earnings-as-of')).toBeTruthy();
      expect(
        screen.getByText(
          i18n.t('translations:earnings_refresh_failed_as_of', {
            time: '13:46',
          }),
        ),
      ).toBeTruthy();
    });

    it('shows no "As of" note when failureCount is 0 and isError is false', () => {
      const updatedAt = Date.parse('2026-11-20T11:46:00.000Z');
      (useEarningsDelivery as jest.Mock).mockReturnValue({
        data: sampleDelivery,
        error: undefined,
        failureReason: undefined,
        failureCount: 0,
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
        dataUpdatedAt: updatedAt,
      });

      render(<EarningsDelivery {...defaultProps} />);

      expect(screen.queryByTestId('earnings-as-of')).toBeNull();
    });
  });

  describe('Pull to refresh (decision 75.43)', () => {
    it('refreshing prop is false during background refetch, true after onRefresh, and false after refetch resolves', async () => {
      let resolveRefetch!: (value?: any) => void;
      const refetchPromise = new Promise<any>(resolve => {
        resolveRefetch = resolve;
      });
      const mockRefetch = jest.fn().mockReturnValue(refetchPromise);

      (useEarningsDelivery as jest.Mock).mockReturnValue({
        data: sampleDelivery,
        isLoading: false,
        isError: false,
        isRefetching: true, // background refetch running
        refetch: mockRefetch,
        dataUpdatedAt: Date.now(),
      });

      render(<EarningsDelivery {...defaultProps} />);

      const refreshControl = screen.UNSAFE_getByType(RefreshControl);
      expect(refreshControl).toBeTruthy();
      // refreshing is false during background refetch
      expect(refreshControl.props.refreshing).toBe(false);

      // Trigger onRefresh
      act(() => {
        refreshControl.props.onRefresh();
      });

      expect(mockRefetch).toHaveBeenCalledTimes(1);
      // refreshing turns true immediately after onRefresh
      expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(
        true,
      );

      // Resolve refetch
      await act(async () => {
        resolveRefetch();
      });

      // refreshing turns false again after resolving
      expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(
        false,
      );
    });
  });
});

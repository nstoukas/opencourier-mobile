import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { EarningsDelivery } from './EarningsDelivery';
import { useEarningsDelivery } from '@app/hooks/useEarnings';
import { MainScreens } from '@app/navigation/main/types';
import { EarningsDeliveryDetail } from '@app/types/earnings';

jest.mock('@app/hooks/useEarnings');

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
    it('shows delivery_not_found and earnings_detail_unavailable when data is missing / 404', () => {
      (useEarningsDelivery as jest.Mock).mockReturnValue({
        data: null,
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
        screen.getByText(i18n.t('translations:earnings_detail_unavailable')),
      ).toBeTruthy();
    });

    it('shows "No connection. As of <time>" when refetch fails over cached data', () => {
      const updatedAt = Date.parse('2026-11-20T11:46:00.000Z');
      (useEarningsDelivery as jest.Mock).mockReturnValue({
        data: sampleDelivery,
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
  });
});

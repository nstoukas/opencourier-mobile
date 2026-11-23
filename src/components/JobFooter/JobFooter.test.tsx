import React from 'react';
import { Text } from 'react-native';
import { render, act } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { OrderStatus } from '@app/types/enums';
import { Order } from '@app/types/types';
import ButtonSwipe from '@app/components/ButtonSwipe/ButtonSwipe';
import { JobFooter } from './JobFooter';

const mockImHere = jest.fn();
const mockPickedUp = jest.fn();
const mockDelivered = jest.fn();

jest.mock('@app/hooks/useOrder', () => () => ({
  imHere: (...args: any[]) => mockImHere(...args),
  pickedUp: (...args: any[]) => mockPickedUp(...args),
  delivered: (...args: any[]) => mockDelivered(...args),
}));

describe('JobFooter (spec 0021, AC-3, AC-5, AC-9, AC-12)', () => {
  const baseOrder: Order = {
    id: 'del-footer-1',
    status: OrderStatus.dispatched,
    pickupBusinessName: 'Acropolis Grill',
  } as unknown as Order;

  beforeEach(() => {
    jest.clearAllMocks();
    mockImHere.mockResolvedValue(true);
    mockPickedUp.mockResolvedValue(true);
    mockDelivered.mockResolvedValue(true);
  });

  it('renders footer container with testID job-footer', () => {
    const { getByTestId } = render(<JobFooter order={baseOrder} />);
    expect(getByTestId('job-footer')).toBeTruthy();
  });

  describe('Swipe actions: Picked up and Delivered (AC-5, AC-9)', () => {
    it('at pickup stage renders swipe with Picked up title and swiping calls pickedUp', async () => {
      const { UNSAFE_getByType } = render(
        <JobFooter order={{ ...baseOrder, status: OrderStatus.dispatched }} />,
      );

      const swipe = UNSAFE_getByType(ButtonSwipe);
      expect(swipe.props.title).toBe(i18n.t('translations:swipe_picked_up'));

      await act(async () => {
        swipe.props.onSwiped(true);
      });

      expect(mockPickedUp).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'del-footer-1' }),
      );
    });

    it('at dropoff stage renders swipe with Delivered title and swiping calls delivered', async () => {
      const { UNSAFE_getByType } = render(
        <JobFooter order={{ ...baseOrder, status: OrderStatus.picked_up }} />,
      );

      const swipe = UNSAFE_getByType(ButtonSwipe);
      expect(swipe.props.title).toBe(i18n.t('translations:swipe_delivered'));

      await act(async () => {
        swipe.props.onSwiped(true);
      });

      expect(mockDelivered).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'del-footer-1' }),
      );
    });

    it('disables swipe while leavingWait is true and enables when false or omitted', () => {
      // 1. leavingWait is true -> swipe is disabled
      const { UNSAFE_getByType, rerender } = render(
        <JobFooter
          order={{ ...baseOrder, status: OrderStatus.dispatched }}
          leavingWait={true}
        />,
      );

      const swipeDisabled = UNSAFE_getByType(ButtonSwipe);
      expect(swipeDisabled.props.enabled).toBe(false);

      // 2. leavingWait is false -> swipe is enabled
      rerender(
        <JobFooter
          order={{ ...baseOrder, status: OrderStatus.dispatched }}
          leavingWait={false}
        />,
      );
      const swipeEnabled = UNSAFE_getByType(ButtonSwipe);
      expect(swipeEnabled.props.enabled).toBe(true);

      // 3. leavingWait is omitted -> swipe defaults to enabled
      rerender(
        <JobFooter order={{ ...baseOrder, status: OrderStatus.dispatched }} />,
      );
      const swipeDefault = UNSAFE_getByType(ButtonSwipe);
      expect(swipeDefault.props.enabled).toBe(true);
    });
  });

  describe('When job is over (row 72, AC-9)', () => {
    it.each([OrderStatus.dropped_off, OrderStatus.canceled])(
      'hides the swipe when status is %s',
      status => {
        const { UNSAFE_queryByType, getByTestId } = render(
          <JobFooter order={{ ...baseOrder, status }} />,
        );

        expect(getByTestId('job-footer')).toBeTruthy();
        expect(UNSAFE_queryByType(ButtonSwipe)).toBeNull();
      },
    );
  });

  describe('Waiting to send indicator', () => {
    it('shows waiting to send message when order.waitingToSend is true', () => {
      const { getByText } = render(
        <JobFooter order={{ ...baseOrder, waitingToSend: true }} />,
      );

      expect(getByText(i18n.t('translations:waiting_to_send'))).toBeTruthy();
    });

    it('shows delivered waiting to send when dropped_off and waitingToSend is true', () => {
      const { getByText } = render(
        <JobFooter
          order={{
            ...baseOrder,
            status: OrderStatus.dropped_off,
            waitingToSend: true,
          }}
        />,
      );

      expect(
        getByText(i18n.t('translations:delivered_waiting_to_send')),
      ).toBeTruthy();
    });
  });

  describe('Waiting clock (spec 0033, AC-5)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('shows waiting clock text only at pickup with an arrival timestamp, and counts up each second', () => {
      const now = 100_000;
      jest.setSystemTime(now);

      // 6 minutes and 12 seconds ago (372,000 ms)
      const arrivedAtOnPhone = now - (6 * 60 + 12) * 1000;
      const orderWaiting = {
        ...baseOrder,
        status: OrderStatus.courier_arrived_at_pickup_location,
        arrivedAtOnPhone,
      } as unknown as Order;

      const { getByTestId } = render(<JobFooter order={orderWaiting} />);

      const clock = getByTestId('job-wait-clock');
      expect(clock).toBeTruthy();
      expect(clock.props.children).toBe('Waiting 6:12');

      // Advances 1 second -> "Waiting 6:13"
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(getByTestId('job-wait-clock').props.children).toBe('Waiting 6:13');
    });

    it('shows "Waiting 6:12 · paid from 12:15" with paidFromOnPhone and just "Waiting 6:12" without', () => {
      const now = 100_000;
      jest.setSystemTime(now);

      const arrivedAtOnPhone = now - (6 * 60 + 12) * 1000;
      // 12:15 local time
      const paidFromOnPhone = new Date('2026-11-09T12:15:00').getTime();

      const orderWithPaid = {
        ...baseOrder,
        status: OrderStatus.courier_arrived_at_pickup_location,
        arrivedAtOnPhone,
        paidFromOnPhone,
      } as unknown as Order;

      const { getByTestId, rerender } = render(
        <JobFooter order={orderWithPaid} />,
      );

      // With paidFromOnPhone: formats with formatShift (HH:mm)
      expect(getByTestId('job-wait-clock').props.children).toBe(
        'Waiting 6:12 · paid from 12:15',
      );

      // Without paidFromOnPhone (null or undefined): reads just "Waiting 6:12"
      const orderWithoutPaid = {
        ...baseOrder,
        status: OrderStatus.courier_arrived_at_pickup_location,
        arrivedAtOnPhone,
        paidFromOnPhone: null,
      } as unknown as Order;

      rerender(<JobFooter order={orderWithoutPaid} />);
      expect(getByTestId('job-wait-clock').props.children).toBe('Waiting 6:12');
    });

    it('hides waiting clock when not at pickup arrival even if arrivedAtOnPhone is set', () => {
      const arrivedAtOnPhone = Date.now() - 60_000;

      // Status dispatched
      const { queryByTestId: queryDispatched, rerender } = render(
        <JobFooter
          order={{
            ...baseOrder,
            status: OrderStatus.dispatched,
            arrivedAtOnPhone,
          }}
        />,
      );
      expect(queryDispatched('job-wait-clock')).toBeNull();

      // Status picked_up
      rerender(
        <JobFooter
          order={{
            ...baseOrder,
            status: OrderStatus.picked_up,
            arrivedAtOnPhone,
          }}
        />,
      );
      expect(queryDispatched('job-wait-clock')).toBeNull();
    });

    it('hides waiting clock at pickup arrival when arrivedAtOnPhone is null or undefined', () => {
      const { queryByTestId, rerender } = render(
        <JobFooter
          order={{
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_pickup_location,
            arrivedAtOnPhone: null,
          }}
        />,
      );
      expect(queryByTestId('job-wait-clock')).toBeNull();

      rerender(
        <JobFooter
          order={{
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_pickup_location,
            arrivedAtOnPhone: undefined,
          }}
        />,
      );
      expect(queryByTestId('job-wait-clock')).toBeNull();
    });
  });

  // Row 138: the small actions moved behind the ⋯ button beside the address
  // (`JobActionsButton`); the footer keeps the swipe and its notices only.
  describe('No action links (row 138)', () => {
    const NOW = 1_800_000_000_000;

    // Jobs on which the old footer drew every one of its links.
    const jobs: Order[] = [
      // On the way to the restaurant, inside the free hand back window.
      {
        ...baseOrder,
        status: OrderStatus.dispatched,
        handBackUntilOnPhone: NOW + 45_000,
      },
      // At the restaurant, late enough to leave.
      {
        ...baseOrder,
        status: OrderStatus.courier_arrived_at_pickup_location,
        leaveFromOnPhone: NOW - 1000,
      },
      { ...baseOrder, status: OrderStatus.picked_up },
      {
        ...baseOrder,
        status: OrderStatus.courier_arrived_at_dropoff_location,
      },
    ] as unknown as Order[];

    const actionLabels = [
      'im_here',
      'call_dispatch',
      'chat',
      'request_removal',
      'removal_withdraw',
      'split_doesnt_fit',
      'split_leave_button',
      'leave_wait_button',
      'report_product',
      'report_issue',
    ];

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(NOW);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('draws no action, no ⋯ button and no sheet at any step', () => {
      for (const order of jobs) {
        const view = render(<JobFooter order={order} />);

        expect(view.queryAllByTestId(/^job-action/)).toHaveLength(0);
        expect(view.queryByTestId('job-actions-button')).toBeNull();
        expect(view.queryByTestId('job-actions-sheet')).toBeNull();
        for (const key of actionLabels) {
          expect(view.queryByText(i18n.t(`translations:${key}`))).toBeNull();
        }
        expect(view.queryByText(/Hand back/)).toBeNull();
        view.unmount();
      }
    });

    it('with no notice to show, the only words in the footer are the swipe’s', () => {
      for (const order of jobs) {
        const view = render(<JobFooter order={order} />);
        const words = view
          .UNSAFE_getAllByType(Text)
          .map(text => text.props.children);

        const swipe = view.UNSAFE_getByType(ButtonSwipe);
        expect(words).toEqual([swipe.props.title]);
        view.unmount();
      }
    });

    it('ignores action handlers handed to it: none of them is drawn or kept', () => {
      // A caller still passing the old props (as Home did) gets no link for them.
      const oldProps = {
        onReportIssue: jest.fn(),
        onCallDispatch: jest.fn(),
        onOpenChat: jest.fn(),
        chatUnseen: true,
        onHandBack: jest.fn(),
        onRequestRemoval: jest.fn(),
      };
      // `as object` lets the test hand over props the type no longer has.
      const view = render(
        <JobFooter order={jobs[0]} {...(oldProps as object)} />,
      );

      expect(view.queryAllByTestId(/^job-action/)).toHaveLength(0);
      expect(view.queryByText(i18n.t('translations:chat'))).toBeNull();
      expect(view.queryByText(i18n.t('translations:report_issue'))).toBeNull();
    });
  });
});

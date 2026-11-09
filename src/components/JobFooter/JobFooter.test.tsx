import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
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
    const { getByTestId } = render(
      <JobFooter order={baseOrder} onReportIssue={jest.fn()} />,
    );
    expect(getByTestId('job-footer')).toBeTruthy();
  });

  describe("I'm here button (AC-3)", () => {
    it("shows I'm here button when arrival at pickup is not on record", () => {
      const { getByTestId } = render(
        <JobFooter
          order={{ ...baseOrder, status: OrderStatus.dispatched }}
          onReportIssue={jest.fn()}
        />,
      );

      const hereButton = getByTestId('job-action-here');
      expect(hereButton).toBeTruthy();

      fireEvent.press(hereButton);
      expect(mockImHere).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'del-footer-1' }),
      );
    });

    it("hides I'm here button when arrival at pickup is already on record", () => {
      const { queryByTestId } = render(
        <JobFooter
          order={{
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_pickup_location,
          }}
          onReportIssue={jest.fn()}
        />,
      );

      expect(queryByTestId('job-action-here')).toBeNull();
    });

    it("shows I'm here button at dropoff when arrival at dropoff is not on record", () => {
      const { getByTestId } = render(
        <JobFooter
          order={{ ...baseOrder, status: OrderStatus.picked_up }}
          onReportIssue={jest.fn()}
        />,
      );

      const hereButton = getByTestId('job-action-here');
      expect(hereButton).toBeTruthy();

      fireEvent.press(hereButton);
      expect(mockImHere).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'del-footer-1' }),
      );
    });

    it("hides I'm here button at dropoff when arrival at dropoff is already on record", () => {
      const { queryByTestId } = render(
        <JobFooter
          order={{
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_dropoff_location,
          }}
          onReportIssue={jest.fn()}
        />,
      );

      expect(queryByTestId('job-action-here')).toBeNull();
    });
  });

  describe('Report issue button (AC-9)', () => {
    it('shows Report issue button in BOTH stages: pickup and dropoff', () => {
      const onReportIssue = jest.fn();

      // At pickup
      const { getByTestId, rerender } = render(
        <JobFooter
          order={{ ...baseOrder, status: OrderStatus.dispatched }}
          onReportIssue={onReportIssue}
        />,
      );
      expect(getByTestId('job-action-report')).toBeTruthy();
      fireEvent.press(getByTestId('job-action-report'));
      expect(onReportIssue).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'del-footer-1' }),
      );

      // At dropoff
      rerender(
        <JobFooter
          order={{ ...baseOrder, status: OrderStatus.picked_up }}
          onReportIssue={onReportIssue}
        />,
      );
      expect(getByTestId('job-action-report')).toBeTruthy();
    });
  });

  describe('Report product button (spec 0032, AC-9)', () => {
    it('shows Report a product action when status is courier_arrived_at_dropoff_location and onReportProduct is provided', () => {
      const onReportProduct = jest.fn();
      const { getByTestId } = render(
        <JobFooter
          order={{
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_dropoff_location,
          }}
          onReportIssue={jest.fn()}
          onReportProduct={onReportProduct}
        />,
      );

      const reportProductButton = getByTestId('job-action-report-product');
      expect(reportProductButton).toBeTruthy();

      fireEvent.press(reportProductButton);
      expect(onReportProduct).toHaveBeenCalledTimes(1);
      expect(onReportProduct).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'del-footer-1' }),
      );
    });

    it('hides Report a product action when onReportProduct is omitted, even at dropoff arrival', () => {
      const { queryByTestId } = render(
        <JobFooter
          order={{
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_dropoff_location,
          }}
          onReportIssue={jest.fn()}
        />,
      );

      expect(queryByTestId('job-action-report-product')).toBeNull();
    });

    it('hides Report a product action at all other statuses even when onReportProduct is provided', () => {
      const onReportProduct = jest.fn();
      const nonDropoffStatuses = [
        OrderStatus.dispatched,
        OrderStatus.courier_arrived_at_pickup_location,
        OrderStatus.picked_up,
        OrderStatus.dropped_off,
        OrderStatus.canceled,
      ];

      for (const status of nonDropoffStatuses) {
        const { queryByTestId, unmount } = render(
          <JobFooter
            order={{
              ...baseOrder,
              status,
            }}
            onReportIssue={jest.fn()}
            onReportProduct={onReportProduct}
          />,
        );

        expect(queryByTestId('job-action-report-product')).toBeNull();
        unmount();
      }
    });
  });

  describe('Call dispatch button (AC-9, row 72)', () => {
    it('shows Call dispatch button when onCallDispatch is provided', () => {
      const onCallDispatch = jest.fn();
      const { getByTestId } = render(
        <JobFooter
          order={baseOrder}
          onReportIssue={jest.fn()}
          onCallDispatch={onCallDispatch}
        />,
      );

      const dispatchButton = getByTestId('job-action-dispatch');
      expect(dispatchButton).toBeTruthy();

      fireEvent.press(dispatchButton);
      expect(onCallDispatch).toHaveBeenCalledTimes(1);
    });

    it('hides Call dispatch button when onCallDispatch is omitted', () => {
      const { queryByTestId } = render(
        <JobFooter order={baseOrder} onReportIssue={jest.fn()} />,
      );

      expect(queryByTestId('job-action-dispatch')).toBeNull();
    });
  });

  describe('Hand back button (spec 0020, spec 0021, AC-9, AC-12)', () => {
    it('shows Hand back button while window is open and calls onHandBack on press', () => {
      const onHandBack = jest.fn();
      const orderInWindow = {
        ...baseOrder,
        status: OrderStatus.dispatched,
        handBackUntilOnPhone: Date.now() + 45_000,
      } as unknown as Order;

      const { getByTestId } = render(
        <JobFooter
          order={orderInWindow}
          onReportIssue={jest.fn()}
          onHandBack={onHandBack}
        />,
      );

      const handBackButton = getByTestId('job-action-hand-back');
      expect(handBackButton).toBeTruthy();

      fireEvent.press(handBackButton);
      expect(onHandBack).toHaveBeenCalledWith(orderInWindow);
    });

    it('disables Hand back button while handingBack is true', () => {
      const orderInWindow = {
        ...baseOrder,
        status: OrderStatus.dispatched,
        handBackUntilOnPhone: Date.now() + 45_000,
      } as unknown as Order;

      const { getByTestId } = render(
        <JobFooter
          order={orderInWindow}
          onReportIssue={jest.fn()}
          onHandBack={jest.fn()}
          handingBack={true}
        />,
      );

      const handBackButton = getByTestId('job-action-hand-back');
      expect(handBackButton.props.accessibilityState).toEqual({
        disabled: true,
      });
    });
  });

  describe('Swipe actions: Picked up and Delivered (AC-5, AC-9)', () => {
    it('at pickup stage renders swipe with Picked up title and swiping calls pickedUp', async () => {
      const { UNSAFE_getByType } = render(
        <JobFooter
          order={{ ...baseOrder, status: OrderStatus.dispatched }}
          onReportIssue={jest.fn()}
        />,
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
        <JobFooter
          order={{ ...baseOrder, status: OrderStatus.picked_up }}
          onReportIssue={jest.fn()}
        />,
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
          onReportIssue={jest.fn()}
          leavingWait={true}
        />,
      );

      const swipeDisabled = UNSAFE_getByType(ButtonSwipe);
      expect(swipeDisabled.props.enabled).toBe(false);

      // 2. leavingWait is false -> swipe is enabled
      rerender(
        <JobFooter
          order={{ ...baseOrder, status: OrderStatus.dispatched }}
          onReportIssue={jest.fn()}
          leavingWait={false}
        />,
      );
      const swipeEnabled = UNSAFE_getByType(ButtonSwipe);
      expect(swipeEnabled.props.enabled).toBe(true);

      // 3. leavingWait is omitted -> swipe defaults to enabled
      rerender(
        <JobFooter
          order={{ ...baseOrder, status: OrderStatus.dispatched }}
          onReportIssue={jest.fn()}
        />,
      );
      const swipeDefault = UNSAFE_getByType(ButtonSwipe);
      expect(swipeDefault.props.enabled).toBe(true);
    });
  });

  describe('When job is over (row 72, AC-9)', () => {
    it('hides all small actions and swipe when status is dropped_off', () => {
      const { queryByTestId, UNSAFE_queryByType } = render(
        <JobFooter
          order={{ ...baseOrder, status: OrderStatus.dropped_off }}
          onReportIssue={jest.fn()}
          onReportProduct={jest.fn()}
          onCallDispatch={jest.fn()}
          onHandBack={jest.fn()}
        />,
      );

      expect(queryByTestId('job-action-here')).toBeNull();
      expect(queryByTestId('job-action-hand-back')).toBeNull();
      expect(queryByTestId('job-action-dispatch')).toBeNull();
      expect(queryByTestId('job-action-report-product')).toBeNull();
      expect(queryByTestId('job-action-report')).toBeNull();
      expect(UNSAFE_queryByType(ButtonSwipe)).toBeNull();
    });
  });

  describe('Waiting to send indicator', () => {
    it('shows waiting to send message when order.waitingToSend is true', () => {
      const { getByText } = render(
        <JobFooter
          order={{ ...baseOrder, waitingToSend: true }}
          onReportIssue={jest.fn()}
        />,
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
          onReportIssue={jest.fn()}
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

      const { getByTestId } = render(
        <JobFooter order={orderWaiting} onReportIssue={jest.fn()} />,
      );

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
        <JobFooter order={orderWithPaid} onReportIssue={jest.fn()} />,
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

      rerender(
        <JobFooter order={orderWithoutPaid} onReportIssue={jest.fn()} />,
      );
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
          onReportIssue={jest.fn()}
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
          onReportIssue={jest.fn()}
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
          onReportIssue={jest.fn()}
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
          onReportIssue={jest.fn()}
        />,
      );
      expect(queryByTestId('job-wait-clock')).toBeNull();
    });
  });

  describe('Leave wait action (spec 0033, AC-6)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(200_000);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('appears exactly at leaveFromOnPhone, not before and not without leaveFromOnPhone', () => {
      const now = 200_000;
      const onLeaveWait = jest.fn();

      // Before leaveFromOnPhone (1 second in the future)
      const orderBefore = {
        ...baseOrder,
        status: OrderStatus.courier_arrived_at_pickup_location,
        leaveFromOnPhone: now + 1000,
      } as unknown as Order;

      const { queryByTestId, rerender } = render(
        <JobFooter
          order={orderBefore}
          onReportIssue={jest.fn()}
          onLeaveWait={onLeaveWait}
        />,
      );
      expect(queryByTestId('job-action-leave-wait')).toBeNull();

      // Exactly at leaveFromOnPhone
      const orderAtLimit = {
        ...baseOrder,
        status: OrderStatus.courier_arrived_at_pickup_location,
        leaveFromOnPhone: now,
      } as unknown as Order;

      rerender(
        <JobFooter
          order={orderAtLimit}
          onReportIssue={jest.fn()}
          onLeaveWait={onLeaveWait}
        />,
      );

      const leaveButton = queryByTestId('job-action-leave-wait');
      expect(leaveButton).toBeTruthy();
      fireEvent.press(leaveButton!);
      expect(onLeaveWait).toHaveBeenCalledWith(orderAtLimit);

      // Without leaveFromOnPhone (null or undefined)
      const orderNoLimit = {
        ...baseOrder,
        status: OrderStatus.courier_arrived_at_pickup_location,
        leaveFromOnPhone: null,
      } as unknown as Order;

      rerender(
        <JobFooter
          order={orderNoLimit}
          onReportIssue={jest.fn()}
          onLeaveWait={onLeaveWait}
        />,
      );
      expect(queryByTestId('job-action-leave-wait')).toBeNull();
    });

    it('appears on a clock tick as fake timers cross leaveFromOnPhone, with no prop change', () => {
      const now = 200_000;
      const onLeaveWait = jest.fn();

      // Waiting at pickup, 1 second before leaveFromOnPhone
      const order = {
        ...baseOrder,
        status: OrderStatus.courier_arrived_at_pickup_location,
        arrivedAtOnPhone: now - 300_000,
        leaveFromOnPhone: now + 1000,
      } as unknown as Order;

      const { queryByTestId } = render(
        <JobFooter
          order={order}
          onReportIssue={jest.fn()}
          onLeaveWait={onLeaveWait}
        />,
      );

      // Before crossing the threshold, Leave is hidden
      expect(queryByTestId('job-action-leave-wait')).toBeNull();

      // Advance 1 second across leaveFromOnPhone
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Leave appears live on the clock tick without prop change
      const leaveButton = queryByTestId('job-action-leave-wait');
      expect(leaveButton).toBeTruthy();
      fireEvent.press(leaveButton!);
      expect(onLeaveWait).toHaveBeenCalledWith(order);
    });

    it('hides Leave button while order.waitingToSend is true even if past leaveFromOnPhone', () => {
      const now = 200_000;
      const orderWaitingToSend = {
        ...baseOrder,
        status: OrderStatus.courier_arrived_at_pickup_location,
        leaveFromOnPhone: now - 10_000,
        waitingToSend: true,
      } as unknown as Order;

      const { queryByTestId } = render(
        <JobFooter
          order={orderWaitingToSend}
          onReportIssue={jest.fn()}
          onLeaveWait={jest.fn()}
        />,
      );

      expect(queryByTestId('job-action-leave-wait')).toBeNull();
    });

    it('disables Leave button while leavingWait is true', () => {
      const now = 200_000;
      const orderAtLimit = {
        ...baseOrder,
        status: OrderStatus.courier_arrived_at_pickup_location,
        leaveFromOnPhone: now - 10_000,
      } as unknown as Order;

      const { getByTestId } = render(
        <JobFooter
          order={orderAtLimit}
          onReportIssue={jest.fn()}
          onLeaveWait={jest.fn()}
          leavingWait={true}
        />,
      );

      const leaveButton = getByTestId('job-action-leave-wait');
      expect(leaveButton.props.accessibilityState).toEqual({
        disabled: true,
      });
    });

    it('hides Leave button when onLeaveWait prop is omitted even if leaveFromOnPhone has passed', () => {
      const now = 200_000;
      const orderAtLimit = {
        ...baseOrder,
        status: OrderStatus.courier_arrived_at_pickup_location,
        leaveFromOnPhone: now - 10_000,
      } as unknown as Order;

      const { queryByTestId } = render(
        <JobFooter order={orderAtLimit} onReportIssue={jest.fn()} />,
      );

      expect(queryByTestId('job-action-leave-wait')).toBeNull();
    });
  });
});

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import ButtonSwipe from '@app/components/ButtonSwipe/ButtonSwipe';
import { OrderStatus } from '@app/types/enums';
import { Order, SplitRequest } from '@app/types/types';
import { JobFooter } from './JobFooter';

jest.mock('@app/hooks/useOrder', () => () => ({
  imHere: jest.fn().mockResolvedValue(true),
  pickedUp: jest.fn().mockResolvedValue(true),
  delivered: jest.fn().mockResolvedValue(true),
}));

// Spec 0047 (row 11): what the job card shows for a split at pickup.
describe('JobFooter split at pickup (spec 0047, AC-1, AC-2, AC-7, AC-8)', () => {
  // The phone's clock in these tests; the request was flagged 3 min 5 s before it.
  const NOW = 1_800_000_000_000;
  const FLAGGED_ON_PHONE = NOW - (3 * 60 + 5) * 1000;
  // Leaving opens 10 minutes after the flag.
  const LEAVE_FROM_ON_PHONE = FLAGGED_ON_PHONE + 10 * 60_000;

  const request = (
    status: SplitRequest['status'],
    overrides: Partial<SplitRequest> = {},
  ): SplitRequest => ({
    id: 'split-1',
    deliveryId: 'del-split',
    status,
    proposedLegs: [{ boxSize: 'LARGE' }, { boxSize: 'SMALL' }],
    finalLegs: null,
    createdAt: '2026-11-21T12:00:00.000Z',
    leaveFrom: '2026-11-21T12:10:00.000Z',
    adminNote: null,
    ...overrides,
  });

  const atRestaurant = (overrides: Partial<Order> = {}): Order =>
    ({
      id: 'del-split',
      status: OrderStatus.courier_arrived_at_pickup_location,
      pickupBusinessName: 'Volos Test Kitchen',
      splitRequest: null,
      ...overrides,
    } as unknown as Order);

  const waiting = (overrides: Partial<Order> = {}): Order =>
    atRestaurant({
      splitRequest: request('OPEN'),
      splitCreatedAtOnPhone: FLAGGED_ON_PHONE,
      splitLeaveFromOnPhone: LEAVE_FROM_ON_PHONE,
      ...overrides,
    });

  // "HH:mm" on the phone's own clock, worked out here without the app's date library.
  const phoneClock = (at: number): string => {
    const date = new Date(at);
    const two = (value: number) => String(value).padStart(2, '0');
    return `${two(date.getHours())}:${two(date.getMinutes())}`;
  };

  const footer = (
    order: Order,
    props: Partial<React.ComponentProps<typeof JobFooter>> = {},
  ) => (
    <JobFooter
      order={order}
      onReportIssue={jest.fn()}
      onRequestSplit={jest.fn()}
      onLeaveSplit={jest.fn()}
      {...props}
    />
  );

  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    jest.useRealTimers();
  });

  describe('"Doesn\'t fit one box" (AC-1: at the restaurant only)', () => {
    it('is offered at the restaurant and opens the proposal for this order', () => {
      const onRequestSplit = jest.fn();
      const order = atRestaurant();
      const { getByTestId, getByText } = render(
        footer(order, { onRequestSplit }),
      );

      expect(getByText("Doesn't fit one box")).toBeTruthy();
      fireEvent.press(getByTestId('job-action-request-split'));

      expect(onRequestSplit).toHaveBeenCalledTimes(1);
      expect(onRequestSplit).toHaveBeenCalledWith(order);
    });

    it.each([
      OrderStatus.accepted,
      OrderStatus.dispatched,
      OrderStatus.picked_up,
      OrderStatus.on_the_way,
      OrderStatus.courier_arrived_at_dropoff_location,
      OrderStatus.dropped_off,
      OrderStatus.canceled,
    ])('is not offered in status %s', status => {
      const { queryByTestId } = render(footer(atRestaurant({ status })));
      expect(queryByTestId('job-action-request-split')).toBeNull();
    });

    it('is not offered while a request is already waiting for dispatch', () => {
      const { queryByTestId } = render(footer(waiting()));
      expect(queryByTestId('job-action-request-split')).toBeNull();
    });

    it('is not offered while a step of this job still waits to be sent', () => {
      const { queryByTestId } = render(
        footer(atRestaurant({ waitingToSend: true })),
      );
      expect(queryByTestId('job-action-request-split')).toBeNull();
    });

    it('is not offered while a send is on its way (a second tap cannot send twice)', () => {
      const { queryByTestId } = render(
        footer(atRestaurant(), { splitBusy: true }),
      );
      expect(queryByTestId('job-action-request-split')).toBeNull();
    });

    it('is not drawn when the screen gave no handler for it', () => {
      const { queryByTestId } = render(
        <JobFooter order={atRestaurant()} onReportIssue={jest.fn()} />,
      );
      expect(queryByTestId('job-action-request-split')).toBeNull();
    });
  });

  describe('while the request is OPEN (AC-2)', () => {
    // Row 11 review: before the limit the line also says when Leave will appear.
    it('says it is waiting for dispatch, with a counter that counts up and the time Leave comes', () => {
      const leaveAt = phoneClock(LEAVE_FROM_ON_PHONE);
      const { getByTestId, getByText } = render(footer(waiting()));

      expect(getByTestId('job-split-waiting')).toBeTruthy();
      expect(
        getByText(`Waiting for dispatch · 3:05 · Leave from ${leaveAt}`),
      ).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(
        getByText(`Waiting for dispatch · 3:06 · Leave from ${leaveAt}`),
      ).toBeTruthy();
    });

    it("the Leave time is the server's leave time on the phone's clock, not ten minutes of the app's own", () => {
      // An instance whose answer time is 4 minutes: Leave comes 4 minutes after the flag.
      const leaveFrom = FLAGGED_ON_PHONE + 4 * 60_000;
      const { getByText } = render(
        footer(waiting({ splitLeaveFromOnPhone: leaveFrom })),
      );

      expect(
        getByText(
          `Waiting for dispatch · 3:05 · Leave from ${phoneClock(leaveFrom)}`,
        ),
      ).toBeTruthy();
    });

    it('once the limit has passed the line no longer promises a Leave time (the button is there)', () => {
      jest.setSystemTime(LEAVE_FROM_ON_PHONE + 1000);
      const { getByText, queryByText, getByTestId } = render(footer(waiting()));

      expect(
        getByText('Waiting for dispatch to split this order · 10:01'),
      ).toBeTruthy();
      expect(queryByText(/Leave from/)).toBeNull();
      expect(getByTestId('job-action-leave-split')).toBeTruthy();
    });

    it('with no leave time on the phone yet it keeps the counter and names no time', () => {
      const { getByText, queryByText } = render(
        footer(waiting({ splitLeaveFromOnPhone: null })),
      );

      expect(
        getByText('Waiting for dispatch to split this order · 3:05'),
      ).toBeTruthy();
      expect(queryByText(/Leave from/)).toBeNull();
    });

    // Row 11 review (cross check 2): while dispatch splits the order those minutes are paid only as the
    // split wait, so the ordinary wait clock is not drawn under the split line.
    it('hides the ordinary wait clock while the request is open', () => {
      const { queryByTestId, queryByText, getByTestId } = render(
        footer(
          waiting({
            arrivedAtOnPhone: NOW - (6 * 60 + 12) * 1000,
            paidFromOnPhone: NOW - 60_000,
          }),
        ),
      );

      expect(getByTestId('job-split-waiting')).toBeTruthy();
      expect(queryByTestId('job-wait-clock')).toBeNull();
      expect(queryByText(/^Waiting 6:12/)).toBeNull();
    });

    it('shows the ordinary wait clock with no request, and again once dispatch has answered', () => {
      const arrivedAtOnPhone = NOW - (6 * 60 + 12) * 1000;

      const plain = render(footer(atRestaurant({ arrivedAtOnPhone })));
      expect(plain.getByTestId('job-wait-clock').props.children).toBe(
        'Waiting 6:12',
      );
      plain.unmount();

      for (const status of ['REFUSED', 'CONFIRMED'] as const) {
        const view = render(
          footer(
            atRestaurant({ arrivedAtOnPhone, splitRequest: request(status) }),
          ),
        );
        expect(view.getByTestId('job-wait-clock').props.children).toBe(
          'Waiting 6:12',
        );
        view.unmount();
      }
    });

    it('says the sentence without a counter when the phone does not know the flag time yet', () => {
      const { getByText } = render(
        footer(waiting({ splitCreatedAtOnPhone: null })),
      );
      expect(
        getByText('Waiting for dispatch to split this order'),
      ).toBeTruthy();
    });

    it('holds the Picked up swipe until dispatch answers', () => {
      const { UNSAFE_getByType } = render(footer(waiting()));
      expect(UNSAFE_getByType(ButtonSwipe).props.enabled).toBe(false);
    });

    it('the swipe works as usual with no request, and after a refusal', () => {
      const plain = render(footer(atRestaurant()));
      expect(plain.UNSAFE_getByType(ButtonSwipe).props.enabled).toBe(true);
      plain.unmount();

      const refused = render(
        footer(atRestaurant({ splitRequest: request('REFUSED') })),
      );
      expect(refused.UNSAFE_getByType(ButtonSwipe).props.enabled).toBe(true);
    });

    it('shows no waiting line once the request is answered', () => {
      for (const status of ['CONFIRMED', 'REFUSED', 'LEFT', 'VOID'] as const) {
        const view = render(
          footer(atRestaurant({ splitRequest: request(status) })),
        );
        expect(view.queryByTestId('job-split-waiting')).toBeNull();
        view.unmount();
      }
    });
  });

  describe('Leave, once the limit has passed (AC-2, AC-8)', () => {
    it('is not offered before the leave time', () => {
      const { queryByTestId } = render(footer(waiting()));
      expect(queryByTestId('job-action-leave-split')).toBeNull();
    });

    it('appears by itself when the leave time comes, while the card stays open', () => {
      const { queryByTestId } = render(footer(waiting()));
      expect(queryByTestId('job-action-leave-split')).toBeNull();

      // 6 min 55 s to go; one second short, still nothing.
      act(() => {
        jest.advanceTimersByTime(LEAVE_FROM_ON_PHONE - NOW - 1000);
      });
      expect(queryByTestId('job-action-leave-split')).toBeNull();

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(queryByTestId('job-action-leave-split')).toBeTruthy();
    });

    it('calls onLeaveSplit with the order when tapped', () => {
      jest.setSystemTime(LEAVE_FROM_ON_PHONE + 1000);
      const onLeaveSplit = jest.fn();
      const order = waiting();
      const { getByTestId, getByText } = render(
        footer(order, { onLeaveSplit }),
      );

      expect(getByText(i18n.t('translations:split_leave_button'))).toBeTruthy();
      fireEvent.press(getByTestId('job-action-leave-split'));

      expect(onLeaveSplit).toHaveBeenCalledTimes(1);
      expect(onLeaveSplit).toHaveBeenCalledWith(order);
    });

    it('is not offered while a leave is on its way', () => {
      jest.setSystemTime(LEAVE_FROM_ON_PHONE + 1000);
      const { queryByTestId } = render(footer(waiting(), { splitBusy: true }));
      expect(queryByTestId('job-action-leave-split')).toBeNull();
    });

    it('is not offered for a request that is no longer open, however late it is', () => {
      jest.setSystemTime(LEAVE_FROM_ON_PHONE + 60_000);
      for (const status of ['CONFIRMED', 'REFUSED'] as const) {
        const view = render(footer(waiting({ splitRequest: request(status) })));
        expect(view.queryByTestId('job-action-leave-split')).toBeNull();
        view.unmount();
      }
    });
  });

  describe("dispatch's answer on the card (AC-7)", () => {
    it("a refusal shows dispatch's sentence, and a tap reads the whole of it", () => {
      const order = atRestaurant({
        splitRequest: request('REFUSED', {
          adminNote: '  It fits if you turn the platter sideways  ',
        }),
      });
      const { getByTestId, getByText } = render(footer(order));

      expect(
        getByText('Dispatch: It fits if you turn the platter sideways'),
      ).toBeTruthy();
      fireEvent.press(getByTestId('job-split-refused'));

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:split_refused_title'),
        'It fits if you turn the platter sideways',
      );
    });

    it('a refusal with no sentence says it fits one box', () => {
      const { getByText } = render(
        footer(atRestaurant({ splitRequest: request('REFUSED') })),
      );
      expect(getByText('Dispatch: it fits one box')).toBeTruthy();
    });

    // Row 11 review: "box 1" was wrong on a leg split again, so the line names the size the rider keeps.
    it('a confirm says the size of the box the rider keeps, and never "box 1"', () => {
      const order = atRestaurant({
        splitRequest: request('CONFIRMED', {
          finalLegs: [{ boxSize: 'MEDIUM' }, { boxSize: 'SMALL' }],
        }),
      });
      const { getByTestId } = render(footer(order));

      expect(getByTestId('job-split-confirmed').props.children).toBe(
        'Split by dispatch: you take the Medium box',
      );
      expect(getByTestId('job-split-confirmed').props.children).not.toMatch(
        /box 1/,
      );
    });

    it('the size shown is the one dispatch confirmed, not the one the rider proposed', () => {
      const order = atRestaurant({
        splitRequest: request('CONFIRMED', {
          proposedLegs: [{ boxSize: 'LARGE' }, { boxSize: 'SMALL' }],
          finalLegs: [{ boxSize: 'SMALL' }, { boxSize: 'SMALL' }],
        }),
      });
      const { getByTestId } = render(footer(order));

      expect(getByTestId('job-split-confirmed').props.children).toBe(
        'Split by dispatch: you take the Small box',
      );
    });

    it('a confirm whose sizes did not arrive still says so, without a size and without "box 1"', () => {
      const { getByTestId } = render(
        footer(atRestaurant({ splitRequest: request('CONFIRMED') })),
      );

      expect(getByTestId('job-split-confirmed').props.children).toBe(
        'Split by dispatch: you take your box',
      );
    });

    it('the answer leaves the card once the rider has picked up', () => {
      const pickedUp = (status: SplitRequest['status']) =>
        atRestaurant({
          status: OrderStatus.picked_up,
          splitRequest: request(status, {
            finalLegs: [{ boxSize: 'LARGE' }, { boxSize: 'SMALL' }],
          }),
        });

      const confirmed = render(footer(pickedUp('CONFIRMED')));
      expect(confirmed.queryByTestId('job-split-confirmed')).toBeNull();
      confirmed.unmount();

      const refused = render(footer(pickedUp('REFUSED')));
      expect(refused.queryByTestId('job-split-refused')).toBeNull();
    });

    it('shows no answer for a job with no split request', () => {
      const { queryByTestId } = render(footer(atRestaurant()));
      expect(queryByTestId('job-split-waiting')).toBeNull();
      expect(queryByTestId('job-split-refused')).toBeNull();
      expect(queryByTestId('job-split-confirmed')).toBeNull();
    });
  });
});

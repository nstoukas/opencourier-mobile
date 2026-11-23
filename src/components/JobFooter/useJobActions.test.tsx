import { act, renderHook } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { OrderStatus } from '@app/types/enums';
import { Order, SplitRequest } from '@app/types/types';
import { JobActionProps, useJobActions } from './useJobActions';

const mockImHere = jest.fn();

jest.mock('@app/hooks/useOrder', () => () => ({
  imHere: (...args: any[]) => mockImHere(...args),
  pickedUp: jest.fn().mockResolvedValue(true),
  delivered: jest.fn().mockResolvedValue(true),
}));

// Row 138: the job's small actions, which the footer listed as links until they moved
// behind the ⋯ button beside the address. Every rule the footer's tests pinned is kept
// here, with one change the operator chose: Έφτασα is offered only at the pickup stage.
describe('useJobActions (row 138: the actions behind the ⋯ button)', () => {
  // The phone's clock in these tests.
  const NOW = 1_800_000_000_000;

  const job = (overrides: Partial<Order> = {}): Order =>
    ({
      id: 'del-actions-1',
      status: OrderStatus.dispatched,
      pickupBusinessName: 'Acropolis Grill',
      removalRequest: null,
      splitRequest: null,
      ...overrides,
    } as unknown as Order);

  // The hook's answer for one job; `props` are the handlers Home gives.
  const actionsFor = (order: Order, props: Partial<JobActionProps> = {}) =>
    renderHook(
      (current: JobActionProps) => useJobActions(current),
      // `initialProps` is what the hook is called with on the first draw.
      { initialProps: { order, onReportIssue: jest.fn(), ...props } },
    );

  const keysOf = (view: ReturnType<typeof actionsFor>): string[] =>
    view.result.current.actions.map(action => action.key);

  const actionOf = (view: ReturnType<typeof actionsFor>, key: string) => {
    const found = view.result.current.actions.find(
      action => action.key === key,
    );
    if (!found) {
      throw new Error(`No action "${key}" in ${keysOf(view).join(', ')}`);
    }
    return found;
  };

  const ALL_STATUSES = [
    OrderStatus.accepted,
    OrderStatus.dispatched,
    OrderStatus.courier_arrived_at_pickup_location,
    OrderStatus.picked_up,
    OrderStatus.on_the_way,
    OrderStatus.courier_arrived_at_dropoff_location,
    OrderStatus.dropped_off,
    OrderStatus.canceled,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    mockImHere.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Έφτασα (I'm here): only at the pickup stage, until the arrival is on record", () => {
    it.each([OrderStatus.accepted, OrderStatus.dispatched])(
      'is offered on the way to the restaurant (%s) and records the arrival for this order',
      status => {
        const order = job({ status });
        const view = actionsFor(order);

        const here = actionOf(view, 'here');
        expect(here.label).toBe(i18n.t('translations:im_here'));
        here.onPress();

        expect(mockImHere).toHaveBeenCalledTimes(1);
        expect(mockImHere).toHaveBeenCalledWith(order);
      },
    );

    it('is gone once the arrival at the restaurant is on record', () => {
      const view = actionsFor(
        job({ status: OrderStatus.courier_arrived_at_pickup_location }),
      );
      expect(keysOf(view)).not.toContain('here');
    });

    // The operator's choice (23 Nov): dropped at the customer, where the Delivered swipe
    // records the arrival itself.
    it.each([
      OrderStatus.picked_up,
      OrderStatus.on_the_way,
      OrderStatus.courier_arrived_at_dropoff_location,
    ])('is never offered at the customer (%s)', status => {
      const view = actionsFor(job({ status }));
      expect(keysOf(view)).not.toContain('here');
    });

    it.each([OrderStatus.dropped_off, OrderStatus.canceled])(
      'is not offered once the job is over (%s)',
      status => {
        const view = actionsFor(job({ status }));
        expect(keysOf(view)).not.toContain('here');
      },
    );
  });

  describe('Report a problem: while the job is not over', () => {
    it.each(
      ALL_STATUSES.filter(
        status =>
          status !== OrderStatus.dropped_off && status !== OrderStatus.canceled,
      ),
    )('is offered in status %s and opens the report for this order', status => {
      const onReportIssue = jest.fn();
      const order = job({ status });
      const view = actionsFor(order, { onReportIssue });

      const report = actionOf(view, 'report');
      expect(report.label).toBe(i18n.t('translations:report_issue'));
      report.onPress();

      expect(onReportIssue).toHaveBeenCalledTimes(1);
      expect(onReportIssue).toHaveBeenCalledWith(order);
    });
  });

  describe('Report a product (spec 0032): only at the customer’s door', () => {
    it('is offered once arrived at the customer, and opens the report for this order', () => {
      const onReportProduct = jest.fn();
      const order = job({
        status: OrderStatus.courier_arrived_at_dropoff_location,
      });
      const view = actionsFor(order, { onReportProduct });

      const product = actionOf(view, 'report-product');
      expect(product.label).toBe(i18n.t('translations:report_product'));
      product.onPress();

      expect(onReportProduct).toHaveBeenCalledTimes(1);
      expect(onReportProduct).toHaveBeenCalledWith(order);
    });

    it('is not offered at the door when the screen gave no handler', () => {
      const view = actionsFor(
        job({ status: OrderStatus.courier_arrived_at_dropoff_location }),
      );
      expect(keysOf(view)).not.toContain('report-product');
    });

    it.each(
      ALL_STATUSES.filter(
        status => status !== OrderStatus.courier_arrived_at_dropoff_location,
      ),
    )('is not offered in status %s', status => {
      const view = actionsFor(job({ status }), { onReportProduct: jest.fn() });
      expect(keysOf(view)).not.toContain('report-product');
    });
  });

  describe('Call dispatch (row 72): only with a dispatch number', () => {
    it('is offered when the screen gives the call, and runs it', () => {
      const onCallDispatch = jest.fn();
      const view = actionsFor(job(), { onCallDispatch });

      const dispatch = actionOf(view, 'dispatch');
      expect(dispatch.label).toBe(i18n.t('translations:call_dispatch'));
      dispatch.onPress();

      expect(onCallDispatch).toHaveBeenCalledTimes(1);
    });

    it('is not offered when the co-op has set no dispatch number', () => {
      const view = actionsFor(job());
      expect(keysOf(view)).not.toContain('dispatch');
    });
  });

  describe('Chat (spec 0034, AC-12)', () => {
    it('is offered even with no dispatch number, and opens the chat for this order', () => {
      const onOpenChat = jest.fn();
      const order = job();
      const view = actionsFor(order, { onOpenChat });

      expect(keysOf(view)).not.toContain('dispatch');
      const chat = actionOf(view, 'chat');
      expect(chat.label).toBe(i18n.t('translations:chat'));
      chat.onPress();

      expect(onOpenChat).toHaveBeenCalledTimes(1);
      expect(onOpenChat).toHaveBeenCalledWith(order);
    });

    it('sits right after Call dispatch when both are offered', () => {
      const view = actionsFor(job(), {
        onCallDispatch: jest.fn(),
        onOpenChat: jest.fn(),
      });
      const keys = keysOf(view);
      expect(keys.indexOf('chat')).toBe(keys.indexOf('dispatch') + 1);
    });

    it('carries the unread dot only while the chat has something unread', () => {
      const unread = actionsFor(job(), {
        onOpenChat: jest.fn(),
        chatUnseen: true,
      });
      expect(actionOf(unread, 'chat').dot).toBe(true);

      for (const chatUnseen of [false, undefined]) {
        const read = actionsFor(job(), { onOpenChat: jest.fn(), chatUnseen });
        expect(actionOf(read, 'chat').dot).toBeFalsy();
      }
    });

    it('is not offered when the screen gave no handler', () => {
      const view = actionsFor(job());
      expect(keysOf(view)).not.toContain('chat');
    });
  });

  describe('Επιστροφή (hand back, spec 0020): while the free window is open', () => {
    const inWindow = (overrides: Partial<Order> = {}) =>
      job({ handBackUntilOnPhone: NOW + 45_000, ...overrides });

    it('is offered with the seconds left and hands this order back', () => {
      const onHandBack = jest.fn();
      const order = inWindow();
      const view = actionsFor(order, { onHandBack });

      const handBack = actionOf(view, 'hand-back');
      expect(handBack.label).toBe(
        i18n.t('translations:hand_back_button', { seconds: 45 }),
      );
      expect(handBack.label).toContain('45');
      handBack.onPress();

      expect(onHandBack).toHaveBeenCalledTimes(1);
      expect(onHandBack).toHaveBeenCalledWith(order);
    });

    it('counts down each second with no prop change', () => {
      const view = actionsFor(inWindow(), { onHandBack: jest.fn() });

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(actionOf(view, 'hand-back').label).toBe(
        i18n.t('translations:hand_back_button', { seconds: 44 }),
      );

      act(() => {
        jest.advanceTimersByTime(4000);
      });
      expect(actionOf(view, 'hand-back').label).toBe(
        i18n.t('translations:hand_back_button', { seconds: 40 }),
      );
    });

    it('leaves by itself when the window closes, and Request removal takes its place', () => {
      const view = actionsFor(inWindow({ handBackUntilOnPhone: NOW + 3000 }), {
        onHandBack: jest.fn(),
        onRequestRemoval: jest.fn(),
      });
      expect(keysOf(view)).toContain('hand-back');
      expect(keysOf(view)).not.toContain('request-removal');

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(keysOf(view)).not.toContain('hand-back');
      expect(keysOf(view)).toContain('request-removal');
      expect(view.result.current.attention).toBe(false);
    });

    it('is disabled while a hand back is on its way, and not otherwise', () => {
      const sending = actionsFor(inWindow(), {
        onHandBack: jest.fn(),
        handingBack: true,
      });
      expect(actionOf(sending, 'hand-back').disabled).toBe(true);

      const idle = actionsFor(inWindow(), {
        onHandBack: jest.fn(),
        handingBack: false,
      });
      expect(actionOf(idle, 'hand-back').disabled).toBeFalsy();
    });

    it('is not offered once the window has passed, or with no window at all', () => {
      for (const handBackUntilOnPhone of [NOW - 1, NOW, null, undefined]) {
        const view = actionsFor(job({ handBackUntilOnPhone }), {
          onHandBack: jest.fn(),
        });
        expect(keysOf(view)).not.toContain('hand-back');
      }
    });

    it('is not offered when the screen gave no handler', () => {
      const view = actionsFor(inWindow());
      expect(keysOf(view)).not.toContain('hand-back');
    });

    it('is not offered once the rider has arrived at the restaurant, or later', () => {
      for (const status of ALL_STATUSES.filter(
        value =>
          value !== OrderStatus.accepted && value !== OrderStatus.dispatched,
      )) {
        const view = actionsFor(inWindow({ status }), {
          onHandBack: jest.fn(),
        });
        expect(keysOf(view)).not.toContain('hand-back');
      }
    });
  });

  describe('Leave a late order (spec 0033, AC-6): once the co-op’s limit has passed', () => {
    const atRestaurant = (overrides: Partial<Order> = {}) =>
      job({
        status: OrderStatus.courier_arrived_at_pickup_location,
        ...overrides,
      });

    it('appears exactly at leaveFromOnPhone, not a second before, and leaves this order', () => {
      const onLeaveWait = jest.fn();

      const before = actionsFor(
        atRestaurant({ leaveFromOnPhone: NOW + 1000 }),
        {
          onLeaveWait,
        },
      );
      expect(keysOf(before)).not.toContain('leave-wait');

      const order = atRestaurant({ leaveFromOnPhone: NOW });
      const atLimit = actionsFor(order, { onLeaveWait });
      const leave = actionOf(atLimit, 'leave-wait');
      expect(leave.label).toBe(i18n.t('translations:leave_wait_button'));
      leave.onPress();

      expect(onLeaveWait).toHaveBeenCalledTimes(1);
      expect(onLeaveWait).toHaveBeenCalledWith(order);
    });

    it('is not offered with no leave time from the server', () => {
      for (const leaveFromOnPhone of [null, undefined]) {
        const view = actionsFor(atRestaurant({ leaveFromOnPhone }), {
          onLeaveWait: jest.fn(),
        });
        expect(keysOf(view)).not.toContain('leave-wait');
      }
    });

    it('is not offered while a step of this job still waits to be sent', () => {
      const view = actionsFor(
        atRestaurant({ leaveFromOnPhone: NOW - 10_000, waitingToSend: true }),
        { onLeaveWait: jest.fn() },
      );
      expect(keysOf(view)).not.toContain('leave-wait');
    });

    it('is disabled while a leave is on its way, and not otherwise', () => {
      const order = atRestaurant({ leaveFromOnPhone: NOW - 10_000 });
      const sending = actionsFor(order, {
        onLeaveWait: jest.fn(),
        leavingWait: true,
      });
      expect(actionOf(sending, 'leave-wait').disabled).toBe(true);

      const idle = actionsFor(order, { onLeaveWait: jest.fn() });
      expect(actionOf(idle, 'leave-wait').disabled).toBeFalsy();
    });

    it('is not offered when the screen gave no handler', () => {
      const view = actionsFor(atRestaurant({ leaveFromOnPhone: NOW - 10_000 }));
      expect(keysOf(view)).not.toContain('leave-wait');
    });

    it('is not offered away from the restaurant, however late it is', () => {
      for (const status of ALL_STATUSES.filter(
        value => value !== OrderStatus.courier_arrived_at_pickup_location,
      )) {
        const view = actionsFor(
          job({ status, leaveFromOnPhone: NOW - 10_000 }),
          { onLeaveWait: jest.fn() },
        );
        expect(keysOf(view)).not.toContain('leave-wait');
      }
    });
  });

  describe('Removal requests (spec 0035, AC-3, AC-5, decision 24.25)', () => {
    const openRequest = {
      id: 'req-open',
      status: 'OPEN',
      label: 'Breakdown',
      paid: true,
      decisionNote: null,
      createdAt: '2026-11-09T10:00:00Z',
    };
    const declinedRequest = { ...openRequest, status: 'DECLINED' };
    // Past the free hand back.
    const held = (overrides: Partial<Order> = {}) =>
      job({ handBackUntilOnPhone: NOW - 60_000, ...overrides });

    const both = {
      onRequestRemoval: jest.fn(),
      onWithdrawRemoval: jest.fn(),
    };

    it('offers Request removal on a held job with no request, and opens it for this order', () => {
      const onRequestRemoval = jest.fn();
      const order = held();
      const view = actionsFor(order, { ...both, onRequestRemoval });

      const request = actionOf(view, 'request-removal');
      expect(request.label).toBe(i18n.t('translations:request_removal'));
      expect(keysOf(view)).not.toContain('withdraw-removal');
      request.onPress();

      expect(onRequestRemoval).toHaveBeenCalledTimes(1);
      expect(onRequestRemoval).toHaveBeenCalledWith(order);
    });

    it('offers Withdraw instead while a request is open, never both', () => {
      const onWithdrawRemoval = jest.fn();
      const order = held({ removalRequest: openRequest } as Partial<Order>);
      const view = actionsFor(order, { ...both, onWithdrawRemoval });

      const withdraw = actionOf(view, 'withdraw-removal');
      expect(withdraw.label).toBe(i18n.t('translations:removal_withdraw'));
      expect(keysOf(view)).not.toContain('request-removal');
      withdraw.onPress();

      expect(onWithdrawRemoval).toHaveBeenCalledTimes(1);
      expect(onWithdrawRemoval).toHaveBeenCalledWith(order);
    });

    it('never offers both, in any status', () => {
      for (const status of ALL_STATUSES) {
        for (const removalRequest of [null, openRequest, declinedRequest]) {
          const view = actionsFor(
            held({ status, removalRequest } as Partial<Order>),
            both,
          );
          const keys = keysOf(view);
          expect(
            keys.includes('request-removal') &&
              keys.includes('withdraw-removal'),
          ).toBe(false);
        }
      }
    });

    it('offers neither while a send is on its way, with no request', () => {
      const view = actionsFor(held(), { ...both, removalBusy: true });
      expect(keysOf(view)).not.toContain('request-removal');
      expect(keysOf(view)).not.toContain('withdraw-removal');

      // Once the send is done, Request removal is back.
      view.rerender({
        order: held(),
        onReportIssue: jest.fn(),
        ...both,
        removalBusy: false,
      });
      expect(keysOf(view)).toContain('request-removal');
    });

    it('offers neither while a withdraw is on its way, on an open request', () => {
      const order = held({ removalRequest: openRequest } as Partial<Order>);
      const view = actionsFor(order, { ...both, removalBusy: true });
      expect(keysOf(view)).not.toContain('request-removal');
      expect(keysOf(view)).not.toContain('withdraw-removal');

      view.rerender({
        order,
        onReportIssue: jest.fn(),
        ...both,
        removalBusy: false,
      });
      expect(keysOf(view)).toContain('withdraw-removal');
      expect(keysOf(view)).not.toContain('request-removal');
    });

    it('lets the rider ask again after a refusal (decision 24.26)', () => {
      const onRequestRemoval = jest.fn();
      const order = held({ removalRequest: declinedRequest } as Partial<Order>);
      const view = actionsFor(order, { ...both, onRequestRemoval });

      actionOf(view, 'request-removal').onPress();
      expect(onRequestRemoval).toHaveBeenCalledWith(order);
      expect(keysOf(view)).not.toContain('withdraw-removal');
    });

    it('keeps the other actions while a request is open (it changes nothing about the job)', () => {
      const view = actionsFor(
        held({ removalRequest: openRequest } as Partial<Order>),
        { ...both, onCallDispatch: jest.fn(), onOpenChat: jest.fn() },
      );
      expect(keysOf(view)).toEqual(
        expect.arrayContaining(['here', 'dispatch', 'chat', 'report']),
      );
    });

    it('does not offer Request removal while the free hand back is on offer', () => {
      const view = actionsFor(
        job({
          status: OrderStatus.accepted,
          handBackUntilOnPhone: NOW + 60_000,
        }),
        { onHandBack: jest.fn(), onRequestRemoval: jest.fn() },
      );
      expect(keysOf(view)).toContain('hand-back');
      expect(keysOf(view)).not.toContain('request-removal');
    });

    it('offers neither on a finished job', () => {
      for (const status of [OrderStatus.dropped_off, OrderStatus.canceled]) {
        for (const removalRequest of [null, openRequest]) {
          const view = actionsFor(
            held({ status, removalRequest } as Partial<Order>),
            both,
          );
          expect(keysOf(view)).not.toContain('request-removal');
          expect(keysOf(view)).not.toContain('withdraw-removal');
        }
      }
    });

    it('offers neither when the screen gave no handlers', () => {
      for (const removalRequest of [null, openRequest]) {
        const view = actionsFor(held({ removalRequest } as Partial<Order>));
        expect(keysOf(view)).not.toContain('request-removal');
        expect(keysOf(view)).not.toContain('withdraw-removal');
      }
    });
  });

  describe('Split at pickup (spec 0047, AC-1, AC-2, AC-8)', () => {
    // The request was flagged 3 min 5 s ago; leaving opens 10 minutes after the flag.
    const FLAGGED_ON_PHONE = NOW - (3 * 60 + 5) * 1000;
    const LEAVE_FROM_ON_PHONE = FLAGGED_ON_PHONE + 10 * 60_000;

    const request = (status: SplitRequest['status']): SplitRequest => ({
      id: 'split-1',
      deliveryId: 'del-actions-1',
      status,
      proposedLegs: [{ boxSize: 'LARGE' }, { boxSize: 'SMALL' }],
      finalLegs: null,
      createdAt: '2026-11-21T12:00:00.000Z',
      leaveFrom: '2026-11-21T12:10:00.000Z',
      adminNote: null,
    });

    const atRestaurant = (overrides: Partial<Order> = {}) =>
      job({
        status: OrderStatus.courier_arrived_at_pickup_location,
        ...overrides,
      });

    const waiting = (overrides: Partial<Order> = {}) =>
      atRestaurant({
        splitRequest: request('OPEN'),
        splitCreatedAtOnPhone: FLAGGED_ON_PHONE,
        splitLeaveFromOnPhone: LEAVE_FROM_ON_PHONE,
        ...overrides,
      });

    const both = { onRequestSplit: jest.fn(), onLeaveSplit: jest.fn() };

    describe('"Doesn\'t fit one box": at the restaurant only', () => {
      it('is offered at the restaurant and opens the proposal for this order', () => {
        const onRequestSplit = jest.fn();
        const order = atRestaurant();
        const view = actionsFor(order, { ...both, onRequestSplit });

        const split = actionOf(view, 'request-split');
        expect(split.label).toBe("Doesn't fit one box");
        split.onPress();

        expect(onRequestSplit).toHaveBeenCalledTimes(1);
        expect(onRequestSplit).toHaveBeenCalledWith(order);
      });

      it.each(
        ALL_STATUSES.filter(
          status => status !== OrderStatus.courier_arrived_at_pickup_location,
        ),
      )('is not offered in status %s', status => {
        const view = actionsFor(job({ status }), both);
        expect(keysOf(view)).not.toContain('request-split');
      });

      it('is not offered while a request is already waiting for dispatch', () => {
        const view = actionsFor(waiting(), both);
        expect(keysOf(view)).not.toContain('request-split');
      });

      it('is not offered while a step of this job still waits to be sent', () => {
        const view = actionsFor(atRestaurant({ waitingToSend: true }), both);
        expect(keysOf(view)).not.toContain('request-split');
      });

      it('is not offered while a send is on its way (a second tap cannot send twice)', () => {
        const view = actionsFor(atRestaurant(), { ...both, splitBusy: true });
        expect(keysOf(view)).not.toContain('request-split');
      });

      it('is not offered when the screen gave no handler', () => {
        const view = actionsFor(atRestaurant());
        expect(keysOf(view)).not.toContain('request-split');
      });

      it('is offered again after a refusal', () => {
        const view = actionsFor(
          atRestaurant({ splitRequest: request('REFUSED') }),
          both,
        );
        expect(keysOf(view)).toContain('request-split');
      });
    });

    describe('Leave, once the split’s limit has passed', () => {
      it('is not offered before the leave time', () => {
        const view = actionsFor(waiting(), both);
        expect(keysOf(view)).not.toContain('leave-split');
      });

      it('is offered from the leave time, marked as the red choice, and leaves this order', () => {
        jest.setSystemTime(LEAVE_FROM_ON_PHONE);
        const onLeaveSplit = jest.fn();
        const order = waiting();
        const view = actionsFor(order, { ...both, onLeaveSplit });

        const leave = actionOf(view, 'leave-split');
        expect(leave.label).toBe(i18n.t('translations:split_leave_button'));
        expect(leave.tone).toBe('destructive');
        leave.onPress();

        expect(onLeaveSplit).toHaveBeenCalledTimes(1);
        expect(onLeaveSplit).toHaveBeenCalledWith(order);
      });

      it('is not offered while a leave is on its way', () => {
        jest.setSystemTime(LEAVE_FROM_ON_PHONE + 1000);
        const view = actionsFor(waiting(), { ...both, splitBusy: true });
        expect(keysOf(view)).not.toContain('leave-split');
      });

      it('is not offered for a request that is no longer open, however late it is', () => {
        jest.setSystemTime(LEAVE_FROM_ON_PHONE + 60_000);
        for (const status of ['CONFIRMED', 'REFUSED'] as const) {
          const view = actionsFor(
            waiting({ splitRequest: request(status) }),
            both,
          );
          expect(keysOf(view)).not.toContain('leave-split');
        }
      });

      it('is not offered when the screen gave no handler', () => {
        jest.setSystemTime(LEAVE_FROM_ON_PHONE + 1000);
        const view = actionsFor(waiting());
        expect(keysOf(view)).not.toContain('leave-split');
      });
    });

    // Spec 0047, OR.4: the ordinary Leave (spec 0033) does not show while a split request is
    // open, even when its own limit has passed; the split's Leave has its own limit.
    it('an open split hides the ordinary Leave, and the split’s Leave comes at its own limit', () => {
      const props = { ...both, onLeaveWait: jest.fn() };
      const order = waiting({ leaveFromOnPhone: NOW - 60_000 });

      const early = actionsFor(order, props);
      expect(keysOf(early)).not.toContain('leave-wait');
      expect(keysOf(early)).not.toContain('leave-split');
      early.unmount();

      jest.setSystemTime(LEAVE_FROM_ON_PHONE + 1000);
      const late = actionsFor(order, props);
      expect(keysOf(late)).not.toContain('leave-wait');
      expect(keysOf(late)).toContain('leave-split');
      late.unmount();

      const refused = actionsFor(
        atRestaurant({
          leaveFromOnPhone: NOW - 60_000,
          splitRequest: request('REFUSED'),
        }),
        props,
      );
      expect(keysOf(refused)).toContain('leave-wait');
      expect(keysOf(refused)).not.toContain('leave-split');
    });
  });

  describe('when the job is over (row 72)', () => {
    it.each([OrderStatus.dropped_off, OrderStatus.canceled])(
      'offers no action at all in status %s, whatever the screen gives',
      status => {
        const view = actionsFor(
          job({
            status,
            handBackUntilOnPhone: NOW + 45_000,
            leaveFromOnPhone: NOW - 1000,
          }),
          {
            onReportProduct: jest.fn(),
            onCallDispatch: jest.fn(),
            onHandBack: jest.fn(),
            onLeaveWait: jest.fn(),
            onRequestRemoval: jest.fn(),
            onWithdrawRemoval: jest.fn(),
            onRequestSplit: jest.fn(),
            onLeaveSplit: jest.fn(),
            onOpenChat: jest.fn(),
          },
        );
        expect(keysOf(view)).toEqual([]);
        expect(view.result.current.attention).toBe(false);
      },
    );
  });

  describe('the list as a whole: exactly what the footer listed, in its order', () => {
    const everything = {
      onReportProduct: jest.fn(),
      onCallDispatch: jest.fn(),
      onHandBack: jest.fn(),
      onLeaveWait: jest.fn(),
      onRequestRemoval: jest.fn(),
      onWithdrawRemoval: jest.fn(),
      onRequestSplit: jest.fn(),
      onLeaveSplit: jest.fn(),
      onOpenChat: jest.fn(),
    };

    it('on the way to the restaurant, inside the hand back window', () => {
      const view = actionsFor(
        job({ handBackUntilOnPhone: NOW + 45_000 }),
        everything,
      );
      expect(keysOf(view)).toEqual([
        'here',
        'hand-back',
        'dispatch',
        'chat',
        'report',
      ]);
    });

    it('on the way to the restaurant, after the hand back window', () => {
      const view = actionsFor(job(), everything);
      expect(keysOf(view)).toEqual([
        'here',
        'dispatch',
        'chat',
        'request-removal',
        'report',
      ]);
    });

    it('at the restaurant, late', () => {
      const view = actionsFor(
        job({
          status: OrderStatus.courier_arrived_at_pickup_location,
          leaveFromOnPhone: NOW - 1000,
        }),
        everything,
      );
      expect(keysOf(view)).toEqual([
        'leave-wait',
        'dispatch',
        'chat',
        'request-removal',
        'request-split',
        'report',
      ]);
    });

    it('on the way to the customer', () => {
      const view = actionsFor(
        job({ status: OrderStatus.picked_up }),
        everything,
      );
      expect(keysOf(view)).toEqual([
        'dispatch',
        'chat',
        'request-removal',
        'report',
      ]);
    });

    it('at the customer’s door', () => {
      const view = actionsFor(
        job({ status: OrderStatus.courier_arrived_at_dropoff_location }),
        everything,
      );
      expect(keysOf(view)).toEqual([
        'dispatch',
        'chat',
        'request-removal',
        'report-product',
        'report',
      ]);
    });

    it('with only the handler every job has, Report a problem is the one action', () => {
      const view = actionsFor(job({ status: OrderStatus.picked_up }));
      expect(keysOf(view)).toEqual(['report']);
      expect(actionOf(view, 'report').tone).toBe('destructive');
    });
  });

  describe('attention: what lights the dot on the ⋯ button', () => {
    it('is on while the hand back is available', () => {
      const view = actionsFor(job({ handBackUntilOnPhone: NOW + 45_000 }), {
        onHandBack: jest.fn(),
      });
      expect(view.result.current.attention).toBe(true);
    });

    it('is on while leaving a late restaurant is available', () => {
      const view = actionsFor(
        job({
          status: OrderStatus.courier_arrived_at_pickup_location,
          leaveFromOnPhone: NOW - 1000,
        }),
        { onLeaveWait: jest.fn() },
      );
      expect(view.result.current.attention).toBe(true);
    });

    it('is on while leaving an unsplit order is available', () => {
      const view = actionsFor(
        job({
          status: OrderStatus.courier_arrived_at_pickup_location,
          splitRequest: { status: 'OPEN' } as SplitRequest,
          splitLeaveFromOnPhone: NOW - 1000,
        }),
        { onLeaveSplit: jest.fn() },
      );
      expect(view.result.current.attention).toBe(true);
    });

    it('is on while the chat has something unread', () => {
      const view = actionsFor(job(), {
        onOpenChat: jest.fn(),
        chatUnseen: true,
      });
      expect(view.result.current.attention).toBe(true);
    });

    it('is off for the everyday actions alone, at every step', () => {
      for (const status of ALL_STATUSES) {
        const view = actionsFor(job({ status }), {
          onReportProduct: jest.fn(),
          onCallDispatch: jest.fn(),
          onHandBack: jest.fn(),
          onLeaveWait: jest.fn(),
          onRequestRemoval: jest.fn(),
          onWithdrawRemoval: jest.fn(),
          onRequestSplit: jest.fn(),
          onLeaveSplit: jest.fn(),
          onOpenChat: jest.fn(),
          chatUnseen: false,
        });
        expect(view.result.current.attention).toBe(false);
      }
    });

    it('is off for an open removal request or an open split still inside its limit', () => {
      const view = actionsFor(
        job({
          status: OrderStatus.courier_arrived_at_pickup_location,
          removalRequest: { status: 'OPEN' },
          splitRequest: { status: 'OPEN' } as SplitRequest,
          splitLeaveFromOnPhone: NOW + 60_000,
        } as Partial<Order>),
        {
          onWithdrawRemoval: jest.fn(),
          onRequestRemoval: jest.fn(),
          onLeaveSplit: jest.fn(),
          onRequestSplit: jest.fn(),
        },
      );
      expect(view.result.current.attention).toBe(false);
    });
  });

  // Row 138 review: the ⋯ button's name says which kind of thing waits.
  describe('attentionKind: what the ⋯ button tells a screen reader', () => {
    const TIMED = [
      [
        'the hand back',
        'hand-back',
        { handBackUntilOnPhone: NOW + 45_000 },
        { onHandBack: jest.fn() },
      ],
      [
        'leaving a late restaurant',
        'leave-wait',
        {
          status: OrderStatus.courier_arrived_at_pickup_location,
          leaveFromOnPhone: NOW - 1000,
        },
        { onLeaveWait: jest.fn() },
      ],
      [
        'leaving an unsplit order',
        'leave-split',
        {
          status: OrderStatus.courier_arrived_at_pickup_location,
          splitRequest: { status: 'OPEN' } as SplitRequest,
          splitLeaveFromOnPhone: NOW - 1000,
        },
        { onLeaveSplit: jest.fn() },
      ],
    ] as const;

    it.each(TIMED)(
      'is "timed" while %s is available',
      (_name, key, overrides, props) => {
        const view = actionsFor(job(overrides as Partial<Order>), props);
        expect(keysOf(view)).toContain(key);
        expect(view.result.current.attentionKind).toBe('timed');
        expect(view.result.current.attention).toBe(true);
      },
    );

    it.each(TIMED)(
      'stays "timed" while %s is available and the chat is unread too',
      (_name, key, overrides, props) => {
        const view = actionsFor(job(overrides as Partial<Order>), {
          ...props,
          onOpenChat: jest.fn(),
          chatUnseen: true,
        });
        expect(keysOf(view)).toContain(key);
        expect(view.result.current.attentionKind).toBe('timed');
        expect(view.result.current.attention).toBe(true);
      },
    );

    it('is "unread" when only the chat has something unread', () => {
      const view = actionsFor(job(), {
        onOpenChat: jest.fn(),
        onHandBack: jest.fn(),
        onLeaveWait: jest.fn(),
        onLeaveSplit: jest.fn(),
        chatUnseen: true,
      });
      expect(view.result.current.attentionKind).toBe('unread');
      expect(view.result.current.attention).toBe(true);
    });

    it('goes from "timed" to "unread" when the hand back window closes over an unread chat', () => {
      const view = actionsFor(job({ handBackUntilOnPhone: NOW + 3000 }), {
        onHandBack: jest.fn(),
        onOpenChat: jest.fn(),
        chatUnseen: true,
      });
      expect(view.result.current.attentionKind).toBe('timed');

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(keysOf(view)).not.toContain('hand-back');
      expect(view.result.current.attentionKind).toBe('unread');
    });

    it('is null exactly when attention is off, at every step', () => {
      for (const status of ALL_STATUSES) {
        const view = actionsFor(job({ status }), {
          onReportProduct: jest.fn(),
          onCallDispatch: jest.fn(),
          onHandBack: jest.fn(),
          onLeaveWait: jest.fn(),
          onRequestRemoval: jest.fn(),
          onWithdrawRemoval: jest.fn(),
          onRequestSplit: jest.fn(),
          onLeaveSplit: jest.fn(),
          onOpenChat: jest.fn(),
          chatUnseen: false,
        });
        expect(view.result.current.attentionKind).toBeNull();
        expect(view.result.current.attention).toBe(false);
      }
    });
  });

  // The footer's Leave appeared by itself when its time came, because the card's clock
  // drew it each second. Behind the ⋯ button the hook keeps that clock itself.
  describe('the waiting clock: Leave appears by itself, with no new props', () => {
    it('at a late restaurant, when the leave time arrives', () => {
      const view = actionsFor(
        job({
          status: OrderStatus.courier_arrived_at_pickup_location,
          arrivedAtOnPhone: NOW - 300_000,
          leaveFromOnPhone: NOW + 2000,
        }),
        { onLeaveWait: jest.fn() },
      );
      expect(keysOf(view)).not.toContain('leave-wait');
      expect(view.result.current.attentionKind).toBeNull();

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(keysOf(view)).not.toContain('leave-wait');

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(keysOf(view)).toContain('leave-wait');
      expect(view.result.current.attentionKind).toBe('timed');
    });

    it('on an unsplit order, when its leave time arrives', () => {
      const view = actionsFor(
        job({
          status: OrderStatus.courier_arrived_at_pickup_location,
          splitRequest: { status: 'OPEN' } as SplitRequest,
          splitCreatedAtOnPhone: NOW - 60_000,
          splitLeaveFromOnPhone: NOW + 2000,
        }),
        { onLeaveSplit: jest.fn() },
      );
      expect(keysOf(view)).not.toContain('leave-split');
      expect(view.result.current.attentionKind).toBeNull();

      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(keysOf(view)).toContain('leave-split');
      expect(view.result.current.attentionKind).toBe('timed');
    });

    it('keeps no clock running away from the restaurant, and stops it when the card goes', () => {
      const onTheWay = actionsFor(job({ status: OrderStatus.on_the_way }), {
        onLeaveWait: jest.fn(),
        onLeaveSplit: jest.fn(),
      });
      expect(jest.getTimerCount()).toBe(0);
      onTheWay.unmount();

      const waiting = actionsFor(
        job({
          status: OrderStatus.courier_arrived_at_pickup_location,
          arrivedAtOnPhone: NOW - 300_000,
          leaveFromOnPhone: NOW + 60_000,
        }),
        { onLeaveWait: jest.fn() },
      );
      expect(jest.getTimerCount()).toBe(1);
      waiting.unmount();
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});

import React from 'react';
import { Alert } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { services } from '@app/services/service';
import { OrderStatus } from '@app/types/enums';
import { Order, SplitRequest } from '@app/types/types';
import { QueryKeys } from '@app/utilities/queryKeys';
import notifee from '@notifee/react-native';
import {
  clearSplitNotices,
  showSplitDecision,
} from '@app/services/splitNotice/splitNotice';
import {
  splitTimesOnPhone,
  useLeaveSplit,
  useSendSplitRequest,
  useSplitBusy,
} from './useSplitRequest';

// Spec 0047 (row 11): sending a split request and leaving an order dispatch did not
// split in time. Online only: sent once, and a send already on its way ignores a tap.
describe('useSplitRequest hooks (spec 0047, AC-1, AC-8)', () => {
  let queryClient: QueryClient;
  let alertSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  const created: SplitRequest = {
    id: 'split-1',
    deliveryId: 'del-A',
    status: 'OPEN',
    proposedLegs: [{ boxSize: 'LARGE' }, { boxSize: 'SMALL' }],
    finalLegs: null,
    createdAt: '2026-11-21T12:00:00.000Z',
    leaveFrom: '2026-11-21T12:10:00.000Z',
    adminNote: null,
  };
  const legs: SplitRequest['proposedLegs'] = [
    { boxSize: 'LARGE' },
    { boxSize: 'SMALL' },
  ];
  const job = (id: string): Order =>
    ({
      id,
      status: OrderStatus.courier_arrived_at_pickup_location,
      splitRequest: null,
    } as unknown as Order);

  // An error shaped like the server's 409 with a sentence, as axios hands it to the app.
  const refusal = (status: number, message: string) =>
    new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
      status,
      data: { error: true, result: [{ message }] },
    } as any);
  // No answer at all: the phone has no signal.
  const noConnection = () => new AxiosError('Network Error', 'ERR_NETWORK');

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
        mutations: { retry: false, gcTime: Infinity },
      },
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  // Lets anything already started (a send is started a moment after the tap) run, so a
  // "nothing was sent" check cannot pass just by looking too early.
  const settle = () =>
    act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

  // The buttons of the newest Alert, so a test can press one.
  const lastAlertButtons = () => {
    const call = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
    return (call?.[2] ?? []) as { text: string; onPress?: () => void }[];
  };

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    consoleLogSpy.mockRestore();
    jest.restoreAllMocks();
    queryClient?.clear();
  });

  describe('splitTimesOnPhone (row 11 review)', () => {
    const PHONE_NOW = 1_800_000_000_000;

    it("starts the request now on the phone's clock, and Leave the server's own gap later", () => {
      expect(
        splitTimesOnPhone(
          {
            createdAt: '2026-11-21T12:00:00.000Z',
            leaveFrom: '2026-11-21T12:10:00.000Z',
          },
          PHONE_NOW,
        ),
      ).toEqual({
        splitCreatedAtOnPhone: PHONE_NOW,
        splitLeaveFromOnPhone: PHONE_NOW + 10 * 60_000,
      });
    });

    it("uses the instance's own answer time, not ten minutes of the app's", () => {
      expect(
        splitTimesOnPhone(
          {
            createdAt: '2026-11-21T12:00:00.000Z',
            leaveFrom: '2026-11-21T12:04:30.000Z',
          },
          PHONE_NOW,
        ).splitLeaveFromOnPhone,
      ).toBe(PHONE_NOW + 4.5 * 60_000);
    });

    it("a phone whose clock is hours off the server's still gets the same gap", () => {
      const wrongClock = PHONE_NOW - 3 * 3_600_000;
      const times = splitTimesOnPhone(
        {
          createdAt: '2026-11-21T12:00:00.000Z',
          leaveFrom: '2026-11-21T12:10:00.000Z',
        },
        wrongClock,
      );

      expect(times.splitCreatedAtOnPhone).toBe(wrongClock);
      expect(times.splitLeaveFromOnPhone).toBe(wrongClock + 10 * 60_000);
    });

    it('names no Leave time, never a wrong one, when a time cannot be read', () => {
      expect(
        splitTimesOnPhone(
          { createdAt: '2026-11-21T12:00:00.000Z', leaveFrom: 'soon' },
          PHONE_NOW,
        ),
      ).toEqual({
        splitCreatedAtOnPhone: PHONE_NOW,
        splitLeaveFromOnPhone: null,
      });
      expect(
        splitTimesOnPhone(
          { createdAt: undefined, leaveFrom: undefined } as any,
          PHONE_NOW,
        ).splitLeaveFromOnPhone,
      ).toBeNull();
    });
  });

  describe('useSendSplitRequest (AC-1)', () => {
    it('sends the boxes for this order, puts the open request on the job at once, and tells the screen it was sent', async () => {
      const wrapper = createWrapper();
      queryClient.setQueryData(
        [QueryKeys.inProgressOrders],
        [job('del-A'), job('del-B')],
      );
      const sendSpy = jest
        .spyOn(services.orderService, 'sendSplitRequest')
        .mockResolvedValue(created);
      const onSent = jest.fn();
      const { result } = renderHook(() => useSendSplitRequest(), { wrapper });

      act(() => {
        result.current.send({ orderId: 'del-A', legs }, onSent);
      });

      await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledWith({ id: 'del-A', legs });
      // The card can say "Waiting for dispatch" before the job list is read again.
      const jobs = queryClient.getQueryData<Order[]>([
        QueryKeys.inProgressOrders,
      ]);
      expect(jobs?.find(item => item.id === 'del-A')?.splitRequest).toEqual(
        created,
      );
      // Another job is left alone.
      expect(jobs?.find(item => item.id === 'del-B')?.splitRequest).toBeNull();
      expect(alertSpy).not.toHaveBeenCalled();
    });

    // Row 11 review: the card counts and offers Leave from what the send answered, even if the read of
    // the job list that follows fails (the phone has no server clock for it yet, and needs none).
    it("puts the request's times on the phone's clock at once: flagged now, Leave the server's gap later", async () => {
      const wrapper = createWrapper();
      queryClient.setQueryData(
        [QueryKeys.inProgressOrders],
        [job('del-A'), job('del-B')],
      );
      jest
        .spyOn(services.orderService, 'sendSplitRequest')
        .mockResolvedValue(created);
      // The read of the job list that follows fails: the times must not depend on it.
      jest
        .spyOn(queryClient, 'invalidateQueries')
        .mockImplementation(() => Promise.resolve());
      const onSent = jest.fn();
      const { result } = renderHook(() => useSendSplitRequest(), { wrapper });

      const before = Date.now();
      act(() => {
        result.current.send({ orderId: 'del-A', legs }, onSent);
      });
      await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
      const after = Date.now();

      const jobs = queryClient.getQueryData<Order[]>([
        QueryKeys.inProgressOrders,
      ]);
      const sent = jobs?.find(item => item.id === 'del-A') as Order;
      expect(sent.splitCreatedAtOnPhone).toBeGreaterThanOrEqual(before);
      expect(sent.splitCreatedAtOnPhone).toBeLessThanOrEqual(after);
      // 12:00 to 12:10 on the server: ten minutes after the flag on the phone.
      expect(sent.splitLeaveFromOnPhone).toBe(
        (sent.splitCreatedAtOnPhone as number) + 10 * 60_000,
      );
      // Another job gets no times.
      const other = jobs?.find(item => item.id === 'del-B') as Order;
      expect(other.splitCreatedAtOnPhone).toBeUndefined();
      expect(other.splitLeaveFromOnPhone).toBeUndefined();
    });

    // Row 11 review: the answer to a new request is a new answer, even if worded like the last one.
    it('a new request forgets the last answer shown for this order, so the same answer is told again', async () => {
      const wrapper = createWrapper();
      jest
        .spyOn(services.orderService, 'sendSplitRequest')
        .mockResolvedValue(created);
      const refusedAnswer = {
        deliveryId: 'del-A',
        outcome: 'REFUSED' as const,
        adminNote: null,
        boxSize: null,
      };
      clearSplitNotices();
      (notifee.displayNotification as jest.Mock).mockClear();
      await showSplitDecision(refusedAnswer);
      await showSplitDecision(refusedAnswer);
      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);

      const onSent = jest.fn();
      const { result } = renderHook(() => useSendSplitRequest(), { wrapper });
      act(() => {
        result.current.send({ orderId: 'del-A', legs }, onSent);
      });
      await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));

      await showSplitDecision(refusedAnswer);
      expect(notifee.displayNotification).toHaveBeenCalledTimes(2);
      clearSplitNotices();
    });

    it('a send that was refused forgets nothing: the old answer is not told again', async () => {
      const wrapper = createWrapper();
      jest
        .spyOn(services.orderService, 'sendSplitRequest')
        .mockRejectedValue(refusal(409, 'This order already has a request.'));
      const refusedAnswer = {
        deliveryId: 'del-A',
        outcome: 'REFUSED' as const,
        adminNote: null,
        boxSize: null,
      };
      clearSplitNotices();
      (notifee.displayNotification as jest.Mock).mockClear();
      await showSplitDecision(refusedAnswer);

      const { result } = renderHook(() => useSendSplitRequest(), { wrapper });
      act(() => {
        result.current.send({ orderId: 'del-A', legs }, jest.fn());
      });
      await waitFor(() => expect(alertSpy).toHaveBeenCalled());

      await showSplitDecision(refusedAnswer);
      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
      clearSplitNotices();
    });

    it('reads the job list again afterwards, for the times on the phone clock', async () => {
      const wrapper = createWrapper();
      jest
        .spyOn(services.orderService, 'sendSplitRequest')
        .mockResolvedValue(created);
      const { result } = renderHook(() => useSendSplitRequest(), { wrapper });
      const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

      act(() => {
        result.current.send({ orderId: 'del-A', legs }, jest.fn());
      });

      await waitFor(() =>
        expect(invalidate).toHaveBeenCalledWith({
          queryKey: [QueryKeys.inProgressOrders],
        }),
      );
    });

    it("a refusal shows the server's own sentence and does not close the screen", async () => {
      const wrapper = createWrapper();
      jest
        .spyOn(services.orderService, 'sendSplitRequest')
        .mockRejectedValue(
          refusal(
            409,
            'This order already has a split request waiting for dispatch.',
          ),
        );
      const onSent = jest.fn();
      const { result } = renderHook(() => useSendSplitRequest(), { wrapper });

      act(() => {
        result.current.send({ orderId: 'del-A', legs }, onSent);
      });

      await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:split_send_failed_title'),
        'This order already has a split request waiting for dispatch.',
      );
      expect(onSent).not.toHaveBeenCalled();
    });

    it('with no signal it says so, and does not pretend the request was sent', async () => {
      const wrapper = createWrapper();
      queryClient.setQueryData([QueryKeys.inProgressOrders], [job('del-A')]);
      jest
        .spyOn(services.orderService, 'sendSplitRequest')
        .mockRejectedValue(noConnection());
      const onSent = jest.fn();
      const { result } = renderHook(() => useSendSplitRequest(), { wrapper });

      act(() => {
        result.current.send({ orderId: 'del-A', legs }, onSent);
      });

      await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:split_send_failed_title'),
        i18n.t('translations:split_send_no_connection'),
      );
      expect(onSent).not.toHaveBeenCalled();
      const jobs = queryClient.getQueryData<Order[]>([
        QueryKeys.inProgressOrders,
      ]);
      expect(jobs?.[0]?.splitRequest).toBeNull();
    });

    it('a server error with no sentence (500) gets the plain "not sent" wording', async () => {
      const wrapper = createWrapper();
      jest
        .spyOn(services.orderService, 'sendSplitRequest')
        .mockRejectedValue(refusal(500, 'Internal stack trace'));
      const { result } = renderHook(() => useSendSplitRequest(), { wrapper });

      act(() => {
        result.current.send({ orderId: 'del-A', legs }, jest.fn());
      });

      await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:split_send_failed_title'),
        i18n.t('translations:split_send_failed'),
      );
    });

    it('a second tap while the first send is on its way sends nothing more', async () => {
      const wrapper = createWrapper();
      let resolveSend!: (value: SplitRequest) => void;
      const sendSpy = jest
        .spyOn(services.orderService, 'sendSplitRequest')
        .mockReturnValue(
          new Promise<SplitRequest>(resolve => {
            resolveSend = resolve;
          }),
        );
      const { result } = renderHook(() => useSendSplitRequest(), { wrapper });
      const busyA = renderHook(() => useSplitBusy('del-A'), { wrapper });
      const busyB = renderHook(() => useSplitBusy('del-B'), { wrapper });

      act(() => {
        result.current.send({ orderId: 'del-A', legs }, jest.fn());
      });
      await waitFor(() => expect(busyA.result.current).toBe(true));
      // Busy is per order: another job's card is not held.
      expect(busyB.result.current).toBe(false);

      act(() => {
        result.current.send({ orderId: 'del-A', legs }, jest.fn());
      });
      await settle();
      expect(sendSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveSend(created);
      });
      await waitFor(() => expect(busyA.result.current).toBe(false));
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('useLeaveSplit (AC-8: asks first)', () => {
    it('asks before leaving, and sends nothing until the rider confirms', async () => {
      const wrapper = createWrapper();
      const leaveSpy = jest
        .spyOn(services.orderService, 'leaveSplit')
        .mockResolvedValue({ status: 'LEFT' });
      const { result } = renderHook(() => useLeaveSplit(), { wrapper });

      act(() => {
        result.current(job('del-A'));
      });

      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy.mock.calls[0][0]).toBe(
        i18n.t('translations:split_leave_title'),
      );
      expect(alertSpy.mock.calls[0][1]).toBe(
        i18n.t('translations:split_leave_body'),
      );
      expect(lastAlertButtons().map(button => button.text)).toEqual([
        i18n.t('translations:split_leave_keep'),
        i18n.t('translations:split_leave_confirm'),
      ]);
      await settle();
      expect(leaveSpy).not.toHaveBeenCalled();
    });

    it('tells the rider what leaving means: the order goes back, and they are paid for the trip and the wait', () => {
      const body = i18n.t('translations:split_leave_body');
      expect(body).toContain('goes back to the restaurant');
      expect(body).toContain('paid for the trip and the wait');
    });

    it('"Keep waiting" sends nothing', async () => {
      const wrapper = createWrapper();
      const leaveSpy = jest
        .spyOn(services.orderService, 'leaveSplit')
        .mockResolvedValue({ status: 'LEFT' });
      const { result } = renderHook(() => useLeaveSplit(), { wrapper });

      act(() => {
        result.current(job('del-A'));
      });
      act(() => {
        lastAlertButtons()[0]?.onPress?.();
      });

      await settle();
      expect(leaveSpy).not.toHaveBeenCalled();
    });

    it('confirming leaves this order and then reads the job list again', async () => {
      const wrapper = createWrapper();
      const leaveSpy = jest
        .spyOn(services.orderService, 'leaveSplit')
        .mockResolvedValue({ status: 'LEFT' });
      const { result } = renderHook(() => useLeaveSplit(), { wrapper });
      const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

      act(() => {
        result.current(job('del-A'));
      });
      act(() => {
        lastAlertButtons()[1]?.onPress?.();
      });

      await waitFor(() => expect(leaveSpy).toHaveBeenCalledTimes(1));
      expect(leaveSpy).toHaveBeenCalledWith('del-A');
      await waitFor(() =>
        expect(invalidate).toHaveBeenCalledWith({
          queryKey: [QueryKeys.inProgressOrders],
        }),
      );
    });

    it("a refusal (409 before the limit) shows the server's sentence", async () => {
      const wrapper = createWrapper();
      jest
        .spyOn(services.orderService, 'leaveSplit')
        .mockRejectedValue(
          refusal(
            409,
            'You can leave after 10 minutes without an answer from dispatch.',
          ),
        );
      const { result } = renderHook(() => useLeaveSplit(), { wrapper });

      act(() => {
        result.current(job('del-A'));
      });
      act(() => {
        lastAlertButtons()[1]?.onPress?.();
      });

      await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(2));
      expect(alertSpy).toHaveBeenLastCalledWith(
        i18n.t('translations:split_leave_failed_title'),
        'You can leave after 10 minutes without an answer from dispatch.',
      );
    });

    it('with no answer from the server it says the order was not left', async () => {
      const wrapper = createWrapper();
      jest
        .spyOn(services.orderService, 'leaveSplit')
        .mockRejectedValue(noConnection());
      const { result } = renderHook(() => useLeaveSplit(), { wrapper });

      act(() => {
        result.current(job('del-A'));
      });
      act(() => {
        lastAlertButtons()[1]?.onPress?.();
      });

      await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(2));
      expect(alertSpy).toHaveBeenLastCalledWith(
        i18n.t('translations:split_leave_failed_title'),
        i18n.t('translations:split_leave_failed'),
      );
    });

    it('a second confirm while the leave is on its way sends nothing more, and does not ask again', async () => {
      const wrapper = createWrapper();
      let resolveLeave!: (value: { status: string }) => void;
      const leaveSpy = jest
        .spyOn(services.orderService, 'leaveSplit')
        .mockReturnValue(
          new Promise<{ status: string }>(resolve => {
            resolveLeave = resolve;
          }),
        );
      const { result } = renderHook(() => useLeaveSplit(), { wrapper });
      const busy = renderHook(() => useSplitBusy('del-A'), { wrapper });

      act(() => {
        result.current(job('del-A'));
      });
      const confirm = lastAlertButtons()[1]?.onPress;
      act(() => {
        confirm?.();
      });
      await waitFor(() => expect(busy.result.current).toBe(true));

      // The same button pressed again, and the Leave action tapped again.
      act(() => {
        confirm?.();
      });
      act(() => {
        result.current(job('del-A'));
      });

      await settle();
      expect(leaveSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveLeave({ status: 'LEFT' });
      });
      await waitFor(() => expect(busy.result.current).toBe(false));
    });
  });
});

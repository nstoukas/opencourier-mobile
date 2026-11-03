import React from 'react';
import { AppState } from 'react-native';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { client } from '@app/services/Client';
import { syncShiftReminders } from '@app/services/shifts/shiftReminder';
import { QueryKeys } from '@app/utilities/queryKeys';
import type { JobContact } from './useJobContact';
import { useShifts, SHIFTS_OFF_SENTENCE } from './useShifts';

jest.mock('@app/services/Client', () => ({
  client: {
    get: jest.fn(),
  },
}));

jest.mock('@app/services/shifts/shiftReminder', () => ({
  syncShiftReminders: jest.fn(() => Promise.resolve()),
}));

// Spec 0027: the schedule query follows the co-op's switch from config/contact, and the reminders follow it.
describe('useShifts (spec 0027, AC-1, AC-9)', () => {
  let queryClient: QueryClient;
  let contact: JobContact | Promise<never>;
  let shiftsAnswer: () => Promise<unknown>;

  const myBooking = {
    id: 'b1',
    shiftSlotId: 'slot-1',
    date: '2026-11-06',
    startsAt: '2026-11-06T17:00:00.000Z',
    endsAt: '2026-11-06T21:00:00.000Z',
    startTime: '19:00',
    endTime: '23:00',
    swapOfferedAt: null,
    dropUntil: '2026-11-06T05:00:00.000Z',
    dropUntilText: '07:00 today',
    slotRemoved: false,
  };
  const schedule = {
    serverNow: new Date().toISOString(),
    occurrences: [],
    myBookings: [myBooking],
  };

  const shiftsOff = () => {
    const error = new AxiosError('Conflict');
    error.response = {
      status: 409,
      statusText: 'Conflict',
      headers: {},
      config: {} as any,
      data: { result: [{ message: SHIFTS_OFF_SENTENCE, statusCode: 409 }] },
    };
    return error;
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const getsOf = (path: string) =>
    (client.get as jest.Mock).mock.calls.filter(([url]) => url === path).length;

  beforeEach(() => {
    jest.clearAllMocks();
    AppState.currentState = 'active';
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    contact = { dispatchPhoneNumber: null, shiftsEnabled: true };
    shiftsAnswer = () => Promise.resolve({ data: { result: schedule } });
    (client.get as jest.Mock).mockImplementation((url: string) => {
      if (url === 'config/contact') {
        return contact instanceof Promise
          ? contact
          : Promise.resolve({ data: { result: contact } });
      }
      if (url === 'shifts') {
        return shiftsAnswer();
      }
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('with Shifts on, reads the schedule and syncs the reminders with the bookings and the clock offset', async () => {
    const { result } = renderHook(() => useShifts(true), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.shiftsOn).toBe(true);
    expect(getsOf('shifts')).toBe(1);
    await waitFor(() =>
      expect(syncShiftReminders).toHaveBeenLastCalledWith(
        [myBooking],
        expect.any(Number),
      ),
    );
    const [, offset] = (syncShiftReminders as jest.Mock).mock.calls.at(-1)!;
    expect(offset).toBe(result.current.data!.clockOffsetMs);
  });

  it('with shiftsEnabled false, never asks for the schedule and syncs the reminders with []', async () => {
    contact = { dispatchPhoneNumber: null, shiftsEnabled: false };
    const { result } = renderHook(() => useShifts(true), { wrapper });
    await waitFor(() => expect(syncShiftReminders).toHaveBeenCalledWith([], 0));
    expect(result.current.shiftsOn).toBe(false);
    expect(getsOf('shifts')).toBe(0);
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('an older saved contact answer without the field keeps shifts off', async () => {
    // Compiles: both new fields are optional on the phone (spec 0027, older cached answers).
    const older: JobContact = { dispatchPhoneNumber: '+30 2421 000000' };
    contact = older;
    const { result } = renderHook(() => useShifts(true), { wrapper });
    await waitFor(() => expect(syncShiftReminders).toHaveBeenCalledWith([], 0));
    expect(result.current.shiftsOn).toBe(false);
    expect(getsOf('shifts')).toBe(0);
  });

  it('while contact has not answered yet: no schedule request and no reminder sync', async () => {
    contact = new Promise<never>(() => {});
    const { result } = renderHook(() => useShifts(true), { wrapper });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    expect(result.current.shiftsOn).toBe(false);
    expect(getsOf('shifts')).toBe(0);
    expect(syncShiftReminders).not.toHaveBeenCalled();
  });

  it('a 409 "Shifts are off." reads config/contact again', async () => {
    shiftsAnswer = () => Promise.reject(shiftsOff());
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useShifts(true), { wrapper });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: [QueryKeys.jobContact],
      }),
    );
    await waitFor(() => expect(getsOf('config/contact')).toBe(2));
  });

  it('another refusal does not read config/contact again', async () => {
    shiftsAnswer = () => {
      const error = shiftsOff();
      error.response!.data = { result: [{ message: 'Something else.' }] };
      return Promise.reject(error);
    };
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useShifts(true), { wrapper });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: [QueryKeys.jobContact],
    });
  });

  it('when Shifts go off after being on, the reminders sync with []', async () => {
    const { result } = renderHook(() => useShifts(true), { wrapper });
    await waitFor(() =>
      expect(syncShiftReminders).toHaveBeenCalledWith(
        [myBooking],
        expect.any(Number),
      ),
    );
    contact = { dispatchPhoneNumber: null, shiftsEnabled: false };
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: [QueryKeys.jobContact] });
    });
    await waitFor(() => expect(result.current.shiftsOn).toBe(false));
    await waitFor(() =>
      expect(syncShiftReminders).toHaveBeenLastCalledWith(
        [],
        expect.any(Number),
      ),
    );
  });

  it('reads the schedule again on return to the foreground, only while on', async () => {
    const listeners: Array<(state: string) => void> = [];
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event: string, listener: any) => {
        listeners.push(listener);
        return { remove: jest.fn() } as any;
      });
    const { result } = renderHook(() => useShifts(true), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    const before = getsOf('shifts');
    act(() => {
      listeners.forEach(listener => listener('active'));
    });
    await waitFor(() => expect(getsOf('shifts')).toBeGreaterThan(before));
  });
});

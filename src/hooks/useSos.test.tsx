import { Alert, Linking } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import '@app/localization/i18n';
import { services } from '@app/services/service';
import { navigationRef } from '@app/navigation/navigationRef';
import { RootScreen } from '@app/navigation/types';
import {
  clearSos,
  endSos,
  getSosRecord,
  isSharing,
  loadSosRecord,
  loadSosRecords,
  markSosStarted,
  resetSosStoreForTests,
  startSos,
} from '@app/services/sosStore';
import * as sosSenderModule from '@app/services/sosSender';
import {
  EMERGENCY_DIAL_URL,
  SOS_ACTIVE_CHECK_RETRY_MS,
  SOS_SEND_EVERY_MS,
  beginSos,
  dialEmergency,
  newSosClientId,
  openSosScreen,
  useSos,
} from './useSos';

jest.mock('@app/services/service', () => ({
  services: {
    sosService: {
      start: jest.fn(),
      getActive: jest.fn(),
      sendPoints: jest.fn(),
      end: jest.fn(),
    },
  },
}));

describe('useSos & beginSos (spec 0022, AC-3, AC-12)', () => {
  let alertSpy: jest.SpyInstance;
  let openURLSpy: jest.SpyInstance;
  let isReadySpy: jest.SpyInstance;
  let getCurrentRouteSpy: jest.SpyInstance;
  let navigateSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.useFakeTimers();
    resetSosStoreForTests();
    sosSenderModule.resetSosSenderForTests();
    await AsyncStorage.clear();
    jest.clearAllMocks();

    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);

    isReadySpy = jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
    getCurrentRouteSpy = jest
      .spyOn(navigationRef, 'getCurrentRoute')
      .mockReturnValue({ name: 'Home', key: 'home-1' } as any);
    navigateSpy = jest
      .spyOn(navigationRef, 'navigate')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    openURLSpy.mockRestore();
    isReadySpy.mockRestore();
    getCurrentRouteSpy.mockRestore();
    navigateSpy.mockRestore();
    jest.useRealTimers();
  });

  describe('newSosClientId', () => {
    it('returns an id of 8+ characters matching [A-Za-z0-9_-]', () => {
      const id = newSosClientId();
      expect(id.length).toBeGreaterThanOrEqual(8);
      expect(/^[A-Za-z0-9_-]+$/.test(id)).toBe(true);
    });
  });

  describe('dialEmergency', () => {
    it('opens tel:112 and alerts when Linking.openURL rejects', async () => {
      openURLSpy.mockRejectedValueOnce(new Error('Dialer unavailable'));

      dialEmergency();

      expect(openURLSpy).toHaveBeenCalledWith(EMERGENCY_DIAL_URL);
      // Wait for catch block to run
      await act(async () => {
        await Promise.resolve();
      });

      expect(alertSpy).toHaveBeenCalledWith(
        'Could not open the dialer. Call 112 from your phone.',
      );
    });
  });

  describe('openSosScreen', () => {
    it('navigates to RootScreen.Sos when ready and not currently on Sos screen', () => {
      openSosScreen();
      expect(navigateSpy).toHaveBeenCalledWith(RootScreen.Sos);
    });

    it('does not navigate if current route is already Sos', () => {
      getCurrentRouteSpy.mockReturnValue({ name: RootScreen.Sos, key: 's-1' });
      openSosScreen();
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('retries when navigationRef is not ready yet', () => {
      isReadySpy.mockReturnValue(false);
      openSosScreen(2);
      expect(navigateSpy).not.toHaveBeenCalled();

      // Becomes ready on retry timer
      isReadySpy.mockReturnValue(true);
      act(() => {
        jest.advanceTimersByTime(250);
      });
      expect(navigateSpy).toHaveBeenCalledWith(RootScreen.Sos);
    });
  });

  describe('beginSos (AC-3)', () => {
    it('writes the record BEFORE opening the dialer, opens Sos screen, and dials 112', async () => {
      let recordAtDialTime: any = null;
      openURLSpy.mockImplementationOnce(() => {
        recordAtDialTime = getSosRecord('rider-1');
        return Promise.resolve(true as any);
      });

      await beginSos('rider-1', 'del-100');

      // The record must exist in storage before dialer was opened
      expect(recordAtDialTime).toBeDefined();
      expect(recordAtDialTime.deliveryId).toBe('del-100');
      expect(recordAtDialTime.clientId.length).toBeGreaterThanOrEqual(8);
      expect(/^[A-Za-z0-9_-]+$/.test(recordAtDialTime.clientId)).toBe(true);
      expect(typeof recordAtDialTime.heldAt).toBe('number');

      // Opened Sos screen and opened dialer with tel:112
      expect(navigateSpy).toHaveBeenCalledWith(RootScreen.Sos);
      expect(openURLSpy).toHaveBeenCalledWith('tel:112');
    });

    it('shows the dialer failure alert when Linking.openURL rejects in beginSos', async () => {
      openURLSpy.mockRejectedValueOnce(new Error('Dialer error'));

      await beginSos('rider-1', undefined);

      await act(async () => {
        await Promise.resolve();
      });

      expect(alertSpy).toHaveBeenCalledWith(
        'Could not open the dialer. Call 112 from your phone.',
      );
    });
  });

  describe('useSos hook lifecycle & launch resume (AC-12)', () => {
    it('when a record kept on the phone is shared -> opens the Sos screen on login', async () => {
      await startSos('rider-1', { clientId: 'c-kept', heldAt: 1000 });

      renderHook(() => useSos('rider-1'));

      await act(async () => {
        for (let i = 0; i < 5; i++) {
          await Promise.resolve();
        }
      });

      expect(navigateSpy).toHaveBeenCalledWith(RootScreen.Sos);
      expect(services.sosService.getActive).not.toHaveBeenCalled();
    });

    it('with no record kept, GET sos/active answering ACTIVE -> resumes Sos with id and opens screen', async () => {
      (services.sosService.getActive as jest.Mock).mockResolvedValueOnce({
        id: 'inc-server-active',
        state: 'ACTIVE',
        deliveryId: null,
        startedAt: '2026-11-03T00:00:00.000Z',
      });

      renderHook(() => useSos('rider-1'));

      await act(async () => {
        for (let i = 0; i < 10; i++) {
          await Promise.resolve();
        }
      });

      expect(services.sosService.getActive).toHaveBeenCalledTimes(1);
      const record = await loadSosRecord('rider-1');
      expect(record?.incidentId).toBe('inc-server-active');
      expect(navigateSpy).toHaveBeenCalledWith(RootScreen.Sos);
    });

    it('with no record kept, GET sos/active answering null or not ACTIVE -> does nothing', async () => {
      // Returns null
      (services.sosService.getActive as jest.Mock).mockResolvedValueOnce(null);

      const { unmount } = renderHook(() => useSos('rider-1'));

      await act(async () => {
        for (let i = 0; i < 5; i++) {
          await Promise.resolve();
        }
      });

      expect(navigateSpy).not.toHaveBeenCalled();
      unmount();

      // Returns CLOSED
      (services.sosService.getActive as jest.Mock).mockResolvedValueOnce({
        id: 'inc-closed',
        state: 'CLOSED',
        deliveryId: null,
        startedAt: '2026-11-03T00:00:00.000Z',
      });

      renderHook(() => useSos('rider-1'));

      await act(async () => {
        for (let i = 0; i < 5; i++) {
          await Promise.resolve();
        }
      });

      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('runs sender at once when record exists, then every 5000 ms (and not before), and stops when record is gone (AC-5)', async () => {
      expect(SOS_SEND_EVERY_MS).toBe(5000);
      const sendSosSpy = jest
        .spyOn(sosSenderModule, 'sendSos')
        .mockResolvedValue('idle');

      await startSos('rider-1', { clientId: 'c1', heldAt: 1000 });

      const { unmount } = renderHook(({ courierId }) => useSos(courierId), {
        initialProps: { courierId: 'rider-1' },
      });

      // Called immediately on mount/appearance
      expect(sendSosSpy).toHaveBeenCalledTimes(1);

      // AC-5: waiting points are sent every 5 s (5000 ms), and not before
      act(() => {
        jest.advanceTimersByTime(4999);
      });
      expect(sendSosSpy).toHaveBeenCalledTimes(1);

      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(sendSosSpy).toHaveBeenCalledTimes(2);

      // Keeps running every 5 s while the record exists
      act(() => {
        jest.advanceTimersByTime(4999);
      });
      expect(sendSosSpy).toHaveBeenCalledTimes(2);

      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(sendSosSpy).toHaveBeenCalledTimes(3);

      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(sendSosSpy).toHaveBeenCalledTimes(4);

      // Once the record is gone, no more rounds
      await act(async () => {
        await clearSos('rider-1', 'c1');
      });

      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(sendSosSpy).toHaveBeenCalledTimes(4);

      act(() => {
        jest.advanceTimersByTime(10000);
      });
      expect(sendSosSpy).toHaveBeenCalledTimes(4);

      unmount();
      sendSosSpy.mockRestore();
    });

    it('shows alert "The co-op closed your SOS" when sender returns endedByCoop', async () => {
      const sendSosSpy = jest
        .spyOn(sosSenderModule, 'sendSos')
        .mockResolvedValue('endedByCoop');

      await startSos('rider-1', { clientId: 'c1', heldAt: 1000 });

      renderHook(() => useSos('rider-1'));

      await act(async () => {
        for (let i = 0; i < 5; i++) {
          await Promise.resolve();
        }
      });

      expect(alertSpy).toHaveBeenCalledWith('The co-op closed your SOS');
      sendSosSpy.mockRestore();
    });
  });

  // Row 73 review fix (AC-4): a hold after "I'm safe" whose end is still
  // unsent starts a new SOS, which is shared.
  describe('a new hold while the last end waits for signal', () => {
    it('beginSos makes a new shared SOS with a new clientId and keeps the ended one; useSos shares again', async () => {
      const sendSosSpy = jest
        .spyOn(sosSenderModule, 'sendSos')
        .mockResolvedValue('noSignal');
      await startSos('rider-1', { clientId: 'c-old', heldAt: 1000 });
      await markSosStarted('rider-1', 'c-old', 'inc-old');
      await endSos('rider-1', { kind: 'safe', tappedAt: 2000 });

      const { result } = renderHook(() => useSos('rider-1'));
      expect(result.current).toBe(false);

      await act(async () => {
        await beginSos('rider-1', undefined);
      });

      const shown = getSosRecord('rider-1');
      expect(shown?.clientId).not.toBe('c-old');
      expect(shown?.incidentId).toBeUndefined();
      expect(isSharing(shown)).toBe(true);
      expect(result.current).toBe(true);
      const all = await loadSosRecords('rider-1');
      expect(all).toHaveLength(2);
      expect(all[0].clientId).toBe('c-old');
      expect(all[0].end?.kind).toBe('safe');
      expect(openURLSpy).toHaveBeenCalledWith('tel:112');
      sendSosSpy.mockRestore();
    });

    it('a hold while an SOS is still shared makes no second record', async () => {
      await startSos('rider-1', { clientId: 'c-live', heldAt: 1000 });

      await beginSos('rider-1', undefined);

      const all = await loadSosRecords('rider-1');
      expect(all.map(record => record.clientId)).toEqual(['c-live']);
    });
  });

  // Row 73 review fix (AC-12): the launch check is retried every 15 s when
  // the server cannot be asked.
  describe('launch check retry when GET sos/active fails', () => {
    const flush = async () => {
      await act(async () => {
        for (let i = 0; i < 10; i++) {
          await Promise.resolve();
        }
      });
    };
    const advance = async (ms: number) => {
      await act(async () => {
        jest.advanceTimersByTime(ms);
      });
      await flush();
    };

    it('is 15 s', () => {
      expect(SOS_ACTIVE_CHECK_RETRY_MS).toBe(15000);
    });

    it('asks again after 15 s (not before), keeps asking until it answers, and resumes an active SOS found on a retry', async () => {
      const sendSosSpy = jest
        .spyOn(sosSenderModule, 'sendSos')
        .mockResolvedValue('idle');
      const getActive = services.sosService.getActive as jest.Mock;
      getActive
        .mockRejectedValueOnce(new Error('no signal'))
        .mockRejectedValueOnce(new Error('no signal'))
        .mockResolvedValueOnce({
          id: 'inc-found',
          state: 'ACTIVE',
          deliveryId: null,
          startedAt: '2026-11-03T00:00:00.000Z',
        });

      const { result } = renderHook(() => useSos('rider-1'));
      await flush();
      expect(getActive).toHaveBeenCalledTimes(1);

      await advance(SOS_ACTIVE_CHECK_RETRY_MS - 1);
      expect(getActive).toHaveBeenCalledTimes(1);
      await advance(1);
      expect(getActive).toHaveBeenCalledTimes(2);
      expect(navigateSpy).not.toHaveBeenCalled();

      await advance(SOS_ACTIVE_CHECK_RETRY_MS);
      expect(getActive).toHaveBeenCalledTimes(3);
      expect((await loadSosRecord('rider-1'))?.incidentId).toBe('inc-found');
      expect(navigateSpy).toHaveBeenCalledWith(RootScreen.Sos);
      expect(result.current).toBe(true);

      // It answered: no more checks.
      await advance(SOS_ACTIVE_CHECK_RETRY_MS * 3);
      expect(getActive).toHaveBeenCalledTimes(3);
      sendSosSpy.mockRestore();
    });

    it('stops asking once the server answers with no active SOS', async () => {
      const getActive = services.sosService.getActive as jest.Mock;
      getActive
        .mockRejectedValueOnce(new Error('no signal'))
        .mockResolvedValueOnce(null);

      renderHook(() => useSos('rider-1'));
      await flush();
      await advance(SOS_ACTIVE_CHECK_RETRY_MS);
      expect(getActive).toHaveBeenCalledTimes(2);

      await advance(SOS_ACTIVE_CHECK_RETRY_MS * 3);
      expect(getActive).toHaveBeenCalledTimes(2);
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('does not retry after unmount', async () => {
      const getActive = services.sosService.getActive as jest.Mock;
      getActive.mockRejectedValue(new Error('no signal'));

      const { unmount } = renderHook(() => useSos('rider-1'));
      await flush();
      expect(getActive).toHaveBeenCalledTimes(1);

      unmount();
      await advance(SOS_ACTIVE_CHECK_RETRY_MS * 3);
      expect(getActive).toHaveBeenCalledTimes(1);
      getActive.mockReset();
    });

    it('does not retry after logout (courierId becomes undefined)', async () => {
      const getActive = services.sosService.getActive as jest.Mock;
      getActive.mockRejectedValue(new Error('no signal'));

      const { rerender } = renderHook(
        ({ courierId }: { courierId: string | undefined }) => useSos(courierId),
        { initialProps: { courierId: 'rider-1' as string | undefined } },
      );
      await flush();
      expect(getActive).toHaveBeenCalledTimes(1);

      rerender({ courierId: undefined });
      await advance(SOS_ACTIVE_CHECK_RETRY_MS * 3);
      expect(getActive).toHaveBeenCalledTimes(1);
      expect(navigateSpy).not.toHaveBeenCalled();
      getActive.mockReset();
    });
  });
});

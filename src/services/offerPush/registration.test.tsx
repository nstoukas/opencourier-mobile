import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { services } from '@app/services/service';
import { unregisterThisPhone, useOfferPushRegistration } from './registration';

jest.mock('@app/services/service', () => ({
  services: {
    notificationDeviceService: {
      registerDevice: jest.fn(() => Promise.resolve()),
      unregisterDevice: jest.fn(() => Promise.resolve()),
    },
  },
}));

function HookHost({ userId }: { userId: string | undefined }) {
  useOfferPushRegistration(userId);
  return null;
}

describe('registration (spec 0003, AC-1, Value 5)', () => {
  const originalOS = Platform.OS;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    Platform.OS = 'android';

    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    Platform.OS = originalOS;
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    infoSpy.mockRestore();
  });

  const getAllLoggedStrings = () =>
    [
      ...logSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
      ...infoSpy.mock.calls,
    ]
      .flat()
      .map(item => (typeof item === 'string' ? item : JSON.stringify(item)))
      .join(' ');

  it('posts token on login and listens for onTokenRefresh', async () => {
    const mockMessaging = messaging();
    const tokenRefreshListeners: ((token: string) => void)[] = [];
    (mockMessaging.onTokenRefresh as jest.Mock).mockImplementation(cb => {
      tokenRefreshListeners.push(cb);
      return jest.fn();
    });
    (mockMessaging.getToken as jest.Mock).mockResolvedValueOnce(
      'fcm-initial-token-111',
    );

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<HookHost userId="courier-user-1" />);
      await Promise.resolve();
    });

    // 1. Initial registration on login
    expect(
      services.notificationDeviceService.registerDevice,
    ).toHaveBeenCalledTimes(1);
    expect(
      services.notificationDeviceService.registerDevice,
    ).toHaveBeenCalledWith('fcm-initial-token-111');

    // 2. Token refresh from Firebase
    await act(async () => {
      tokenRefreshListeners.forEach(listener =>
        listener('fcm-refreshed-token-222'),
      );
      await Promise.resolve();
    });

    expect(
      services.notificationDeviceService.registerDevice,
    ).toHaveBeenCalledTimes(2);
    expect(
      services.notificationDeviceService.registerDevice,
    ).toHaveBeenLastCalledWith('fcm-refreshed-token-222');

    // Token must never appear in any log (Value 5, AC-1)
    const allLogs = getAllLoggedStrings();
    expect(allLogs).not.toContain('fcm-initial-token-111');
    expect(allLogs).not.toContain('fcm-refreshed-token-222');

    tree!.unmount();
  });

  it('does not register token when userId is undefined (logged out)', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<HookHost userId={undefined} />);
      await Promise.resolve();
    });

    expect(
      services.notificationDeviceService.registerDevice,
    ).not.toHaveBeenCalled();
    tree!.unmount();
  });

  it('does not register on non-Android platform (e.g. iOS)', async () => {
    Platform.OS = 'ios';

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<HookHost userId="courier-ios" />);
      await Promise.resolve();
    });

    expect(
      services.notificationDeviceService.registerDevice,
    ).not.toHaveBeenCalled();
    tree!.unmount();
  });

  it('unregisterThisPhone unregisters device token with timeout', async () => {
    (messaging().getToken as jest.Mock).mockResolvedValueOnce(
      'fcm-logout-token-333',
    );

    await unregisterThisPhone(3000);

    expect(
      services.notificationDeviceService.unregisterDevice,
    ).toHaveBeenCalledTimes(1);
    expect(
      services.notificationDeviceService.unregisterDevice,
    ).toHaveBeenCalledWith('fcm-logout-token-333', { timeoutMs: 3000 });

    // Token must never appear in any log
    expect(getAllLoggedStrings()).not.toContain('fcm-logout-token-333');
  });

  it('unregisterThisPhone handles getToken failure cleanly without hanging', async () => {
    (messaging().getToken as jest.Mock).mockRejectedValueOnce(
      new Error('FCM unavailable'),
    );

    await expect(unregisterThisPhone(3000)).resolves.toBeUndefined();
    expect(
      services.notificationDeviceService.unregisterDevice,
    ).not.toHaveBeenCalled();
  });

  describe('no bearer token in log lines on error (Job B6, Job C4)', () => {
    it('register failure does not log bearer token or FCM token in any console.log argument', async () => {
      const axiosError: any = new Error('Request failed with status code 500');
      axiosError.name = 'AxiosError';
      axiosError.config = {
        headers: {
          Authorization: 'Bearer secret-token',
        },
      };

      const pushToken = 'fcm-secret-registration-token';
      (
        services.notificationDeviceService.registerDevice as jest.Mock
      ).mockRejectedValueOnce(axiosError);
      (messaging().getToken as jest.Mock).mockResolvedValueOnce(pushToken);

      let tree: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(<HookHost userId="courier-user-err" />);
        await Promise.resolve();
      });

      const logCalls = logSpy.mock.calls;
      expect(logCalls.length).toBeGreaterThan(0);

      // Verify no console.log argument (stringified or direct value) contains 'secret-token' or the push token
      for (const callArgs of logCalls) {
        for (const arg of callArgs) {
          const directStr = String(arg);
          expect(directStr).not.toContain('secret-token');
          expect(directStr).not.toContain(pushToken);

          if (typeof arg === 'object' && arg !== null) {
            const jsonStr = JSON.stringify(arg);
            expect(jsonStr).not.toContain('secret-token');
            expect(jsonStr).not.toContain(pushToken);
          }
        }
      }

      tree!.unmount();
    });

    it('unregister failure does not log bearer token or FCM token in any console.log argument', async () => {
      const axiosError: any = new Error('Request failed with status code 500');
      axiosError.name = 'AxiosError';
      axiosError.config = {
        headers: {
          Authorization: 'Bearer secret-token',
        },
      };

      const pushToken = 'fcm-secret-unregistration-token';
      (
        services.notificationDeviceService.unregisterDevice as jest.Mock
      ).mockRejectedValueOnce(axiosError);
      (messaging().getToken as jest.Mock).mockResolvedValueOnce(pushToken);

      await unregisterThisPhone(3000);

      const logCalls = logSpy.mock.calls;
      expect(logCalls.length).toBeGreaterThan(0);

      for (const callArgs of logCalls) {
        for (const arg of callArgs) {
          const directStr = String(arg);
          expect(directStr).not.toContain('secret-token');
          expect(directStr).not.toContain(pushToken);

          if (typeof arg === 'object' && arg !== null) {
            const jsonStr = JSON.stringify(arg);
            expect(jsonStr).not.toContain('secret-token');
            expect(jsonStr).not.toContain(pushToken);
          }
        }
      }
    });
  });
});

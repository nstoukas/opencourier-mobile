import React from 'react';
import { AppState, Linking, PermissionsAndroid, Platform } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import UserContext from '@app/context/userContext';
import {
  requestAndroidPermission,
  requestAndroidLocation,
  isApproximateLocationOnly,
  requestNotifications,
  BLOCKED_DIALOG_WAIT_MS,
} from './permissions';
import { useLocationPermission } from '@app/hooks/useLocationPermission';

describe('permissions utilities (spec 0039, AC-15, AC-16, decision 17.22)', () => {
  const originalOS = Platform.OS;
  let versionSpy: jest.SpyInstance;
  let openSettingsSpy: jest.SpyInstance;
  let requestSpy: jest.SpyInstance;
  let requestMultipleSpy: jest.SpyInstance;
  let checkSpy: jest.SpyInstance;
  let appStateSpy: jest.SpyInstance;
  let appStateListeners: Array<(state: string) => void> = [];

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    appStateListeners = [];
    versionSpy = jest.spyOn(Platform, 'Version', 'get').mockReturnValue(33);
    openSettingsSpy = jest
      .spyOn(Linking, 'openSettings')
      .mockResolvedValue(undefined as any);
    requestSpy = jest.spyOn(PermissionsAndroid, 'request');
    requestMultipleSpy = jest.spyOn(PermissionsAndroid, 'requestMultiple');
    checkSpy = jest.spyOn(PermissionsAndroid, 'check');
    appStateSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((event: string, listener: any) => {
        if (event === 'change') {
          appStateListeners.push(listener);
        }
        return {
          remove: () => {
            appStateListeners = appStateListeners.filter(l => l !== listener);
          },
        } as any;
      });
  });

  afterEach(() => {
    Platform.OS = originalOS;
    versionSpy.mockRestore();
    openSettingsSpy.mockRestore();
    requestSpy.mockRestore();
    requestMultipleSpy.mockRestore();
    checkSpy.mockRestore();
    appStateSpy.mockRestore();
    jest.useRealTimers();
  });

  describe('requestAndroidPermission and askWithBlockedDetection (Clause 1)', () => {
    it('returns "granted" when PermissionsAndroid.request resolves GRANTED', async () => {
      requestSpy.mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

      const result = await requestAndroidPermission(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );

      expect(result).toBe('granted');
    });

    it('returns "blocked" when PermissionsAndroid.request resolves NEVER_ASK_AGAIN', async () => {
      requestSpy.mockResolvedValue(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);

      const result = await requestAndroidPermission(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );

      expect(result).toBe('blocked');
    });

    it('returns "blocked" when request is still pending after 1.5 s and no dialog was shown', async () => {
      jest.useFakeTimers();
      // Unresolved promise simulating Android not showing a dialog
      requestSpy.mockReturnValue(new Promise(() => {}));

      const promise = requestAndroidPermission(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );

      act(() => {
        jest.advanceTimersByTime(BLOCKED_DIALOG_WAIT_MS);
      });

      const result = await promise;
      expect(result).toBe('blocked');
    });

    it('does NOT count request as blocked when dialog was shown (AppState left active) and rider answers after > 1.5 s', async () => {
      jest.useFakeTimers();
      let resolveRequest!: (value: any) => void;
      requestSpy.mockReturnValue(
        new Promise(resolve => {
          resolveRequest = resolve;
        }),
      );

      const promise = requestAndroidPermission(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );

      // AppState changes to background (dialog is shown on top)
      act(() => {
        appStateListeners.forEach(l => l('background'));
      });

      // Advance timers past 1.5 s
      act(() => {
        jest.advanceTimersByTime(BLOCKED_DIALOG_WAIT_MS + 500);
      });

      // Rider answers granted
      await act(async () => {
        resolveRequest(PermissionsAndroid.RESULTS.GRANTED);
      });

      const result = await promise;
      expect(result).toBe('granted');
      expect(openSettingsSpy).not.toHaveBeenCalled();
    });
  });

  describe('requestAndroidLocation (decision 17.22, Clause 2)', () => {
    it('calls PermissionsAndroid.requestMultiple with ACCESS_FINE_LOCATION and ACCESS_COARSE_LOCATION', async () => {
      requestMultipleSpy.mockResolvedValue({
        [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]:
          PermissionsAndroid.RESULTS.GRANTED,
        [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]:
          PermissionsAndroid.RESULTS.GRANTED,
      });

      const result = await requestAndroidLocation();

      expect(requestMultipleSpy).toHaveBeenCalledWith([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);
      expect(result).toBe('granted');
    });

    it('returns "granted" when FINE is granted', async () => {
      requestMultipleSpy.mockResolvedValue({
        [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]:
          PermissionsAndroid.RESULTS.GRANTED,
        [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]:
          PermissionsAndroid.RESULTS.DENIED,
      });

      const result = await requestAndroidLocation();
      expect(result).toBe('granted');
    });

    it('returns "approximate" when FINE is denied and COARSE is granted', async () => {
      requestMultipleSpy.mockResolvedValue({
        [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]:
          PermissionsAndroid.RESULTS.DENIED,
        [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]:
          PermissionsAndroid.RESULTS.GRANTED,
      });

      const result = await requestAndroidLocation();
      expect(result).toBe('approximate');
    });

    it('returns "blocked" when FINE is never_ask_again and COARSE is not granted', async () => {
      requestMultipleSpy.mockResolvedValue({
        [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]:
          PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
        [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]:
          PermissionsAndroid.RESULTS.DENIED,
      });

      const result = await requestAndroidLocation();
      expect(result).toBe('blocked');
    });

    it('returns "denied" when FINE is denied and COARSE is not granted', async () => {
      requestMultipleSpy.mockResolvedValue({
        [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]:
          PermissionsAndroid.RESULTS.DENIED,
        [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]:
          PermissionsAndroid.RESULTS.DENIED,
      });

      const result = await requestAndroidLocation();
      expect(result).toBe('denied');
    });
  });

  describe('isApproximateLocationOnly (decision 17.22, Clause 2)', () => {
    it('returns false on iOS', async () => {
      Platform.OS = 'ios';
      const result = await isApproximateLocationOnly();
      expect(result).toBe(false);
      expect(checkSpy).not.toHaveBeenCalled();
    });

    it('returns true on Android only when FINE is not granted and COARSE is granted', async () => {
      Platform.OS = 'android';
      checkSpy.mockImplementation(async (perm: any) => {
        if (perm === PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION) {
          return false;
        }
        if (perm === PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION) {
          return true;
        }
        return false;
      });

      const result = await isApproximateLocationOnly();
      expect(result).toBe(true);
    });

    it('returns false on Android when FINE is granted (even if COARSE is granted)', async () => {
      Platform.OS = 'android';
      checkSpy.mockResolvedValue(true);

      const result = await isApproximateLocationOnly();
      expect(result).toBe(false);
    });

    it('returns false on Android when neither is granted', async () => {
      Platform.OS = 'android';
      checkSpy.mockResolvedValue(false);

      const result = await isApproximateLocationOnly();
      expect(result).toBe(false);
    });
  });

  describe('requestNotifications (AC-15)', () => {
    it('when Android answers "never_ask_again", calls Linking.openSettings and returns false', async () => {
      requestSpy.mockResolvedValue(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);

      const result = await requestNotifications();

      expect(openSettingsSpy).toHaveBeenCalledTimes(1);
      expect(result).toBe(false);
    });

    it('when Android answers "granted", does not call Linking.openSettings and returns true', async () => {
      requestSpy.mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

      const result = await requestNotifications();

      expect(openSettingsSpy).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('when notification request is still pending after 1.5 s, treats as blocked, calls Linking.openSettings and returns false', async () => {
      jest.useFakeTimers();
      requestSpy.mockReturnValue(new Promise(() => {}));

      const promise = requestNotifications();

      act(() => {
        jest.advanceTimersByTime(BLOCKED_DIALOG_WAIT_MS);
      });

      const result = await promise;

      expect(openSettingsSpy).toHaveBeenCalledTimes(1);
      expect(result).toBe(false);
    });

    it('does NOT call Linking.openSettings when notification dialog was shown and rider denies after > 1.5 s', async () => {
      jest.useFakeTimers();
      let resolveRequest!: (value: any) => void;
      requestSpy.mockReturnValue(
        new Promise(resolve => {
          resolveRequest = resolve;
        }),
      );

      const promise = requestNotifications();

      act(() => {
        appStateListeners.forEach(l => l('background'));
        jest.advanceTimersByTime(BLOCKED_DIALOG_WAIT_MS + 500);
      });

      await act(async () => {
        resolveRequest(PermissionsAndroid.RESULTS.DENIED);
      });

      const result = await promise;
      expect(result).toBe(false);
      expect(openSettingsSpy).not.toHaveBeenCalled();
    });
  });

  describe('requestLocationPermission with openSettingsIfBlocked (AC-15, AC-16, decision 17.22, Clause 3)', () => {
    const mockSetLocationPermission = jest.fn();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        UserContext.Provider,
        {
          value: {
            locationPermission: false,
            setLocationPermission: mockSetLocationPermission,
            userLatitude: null,
            setUserLatitude: jest.fn(),
            userLongitude: null,
            setUserLongitude: jest.fn(),
          },
        },
        children,
      );

    it('when location is blocked and openSettingsIfBlocked is true, calls Linking.openSettings and returns false', async () => {
      requestMultipleSpy.mockResolvedValue({
        [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]:
          PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
        [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]:
          PermissionsAndroid.RESULTS.DENIED,
      });

      const { result } = renderHook(() => useLocationPermission(), { wrapper });

      let granted: boolean | undefined;
      await act(async () => {
        granted = await result.current.requestLocationPermission({
          openSettingsIfBlocked: true,
        });
      });

      expect(openSettingsSpy).toHaveBeenCalledTimes(1);
      expect(granted).toBe(false);
      expect(mockSetLocationPermission).toHaveBeenCalledWith(false);
    });

    it('when location is "approximate", returns false and does NOT call Linking.openSettings even with openSettingsIfBlocked', async () => {
      requestMultipleSpy.mockResolvedValue({
        [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]:
          PermissionsAndroid.RESULTS.DENIED,
        [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]:
          PermissionsAndroid.RESULTS.GRANTED,
      });

      const { result } = renderHook(() => useLocationPermission(), { wrapper });

      let granted: boolean | undefined;
      await act(async () => {
        granted = await result.current.requestLocationPermission({
          openSettingsIfBlocked: true,
        });
      });

      expect(openSettingsSpy).not.toHaveBeenCalled();
      expect(granted).toBe(false);
      expect(mockSetLocationPermission).toHaveBeenCalledWith(false);
    });

    it('when location is granted, does not call Linking.openSettings and returns true', async () => {
      requestMultipleSpy.mockResolvedValue({
        [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]:
          PermissionsAndroid.RESULTS.GRANTED,
        [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]:
          PermissionsAndroid.RESULTS.GRANTED,
      });

      const { result } = renderHook(() => useLocationPermission(), { wrapper });

      let granted: boolean | undefined;
      await act(async () => {
        granted = await result.current.requestLocationPermission({
          openSettingsIfBlocked: true,
        });
      });

      expect(openSettingsSpy).not.toHaveBeenCalled();
      expect(granted).toBe(true);
      expect(mockSetLocationPermission).toHaveBeenCalledWith(true);
    });

    it('when location is blocked and openSettingsIfBlocked is false or omitted, does not call Linking.openSettings', async () => {
      requestMultipleSpy.mockResolvedValue({
        [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]:
          PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
        [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]:
          PermissionsAndroid.RESULTS.DENIED,
      });

      const { result } = renderHook(() => useLocationPermission(), { wrapper });

      let granted: boolean | undefined;
      await act(async () => {
        granted = await result.current.requestLocationPermission();
      });

      expect(openSettingsSpy).not.toHaveBeenCalled();
      expect(granted).toBe(false);
    });
  });
});

import React from 'react';
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import UserContext from '@app/context/userContext';
import {
  requestAndroidPermission,
  requestNotifications,
  BLOCKED_DIALOG_WAIT_MS,
} from './permissions';
import { useLocationPermission } from '@app/hooks/useLocationPermission';

describe('permissions utilities (spec 0039, AC-15)', () => {
  const originalOS = Platform.OS;
  let versionSpy: jest.SpyInstance;
  let openSettingsSpy: jest.SpyInstance;
  let requestSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    versionSpy = jest.spyOn(Platform, 'Version', 'get').mockReturnValue(33);
    openSettingsSpy = jest
      .spyOn(Linking, 'openSettings')
      .mockResolvedValue(undefined as any);
    requestSpy = jest.spyOn(PermissionsAndroid, 'request');
  });

  afterEach(() => {
    Platform.OS = originalOS;
    versionSpy.mockRestore();
    openSettingsSpy.mockRestore();
    requestSpy.mockRestore();
    jest.useRealTimers();
  });

  describe('requestAndroidPermission', () => {
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

    it('returns "blocked" when request is still pending after 1.5 s', async () => {
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
  });

  describe('requestLocationPermission with openSettingsIfBlocked (AC-15, AC-16)', () => {
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
      requestSpy.mockResolvedValue(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);

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

    it('when location is granted, does not call Linking.openSettings and returns true', async () => {
      requestSpy.mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

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
      requestSpy.mockResolvedValue(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);

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

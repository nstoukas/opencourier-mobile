import React from 'react';
import { AppState, Linking, PermissionsAndroid, Platform } from 'react-native';
import { renderHook, act, cleanup } from '@testing-library/react-native';
import UserContext from '@app/context/userContext';
import * as permissionsUtil from '@app/utilities/permissions';
import {
  useLocationPermission,
  useGrantedLocationPermission,
} from './useLocationPermission';

describe('useLocationPermission (Row 67, Clause 6, Decision 67.5)', () => {
  const originalOS = Platform.OS;
  const mockSetLocationPermission = jest.fn();
  let checkSpy: jest.SpyInstance;
  let requestSpy: jest.SpyInstance;
  let appStateSpy: jest.SpyInstance;
  let appStateListener: ((state: string) => void) | undefined;
  const mockSubscriptionRemove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    appStateListener = undefined;

    checkSpy = jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
    requestSpy = jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

    appStateSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((event: any, listener: any) => {
        if (event === 'change') {
          appStateListener = listener;
        }
        return { remove: mockSubscriptionRemove } as any;
      });
  });

  afterEach(() => {
    cleanup();
    Platform.OS = originalOS;
    checkSpy.mockRestore();
    requestSpy.mockRestore();
    appStateSpy.mockRestore();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <UserContext.Provider
      value={{
        locationPermission: false,
        setLocationPermission: mockSetLocationPermission,
        userLatitude: null,
        setUserLatitude: jest.fn(),
        userLongitude: null,
        setUserLongitude: jest.fn(),
      }}>
      {children}
    </UserContext.Provider>
  );

  it('reads PermissionsAndroid.check(ACCESS_FINE_LOCATION) on mount without requesting and sets context to true', async () => {
    checkSpy.mockResolvedValue(true);

    renderHook(() => useGrantedLocationPermission(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(checkSpy).toHaveBeenCalledWith(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    expect(requestSpy).not.toHaveBeenCalled();
    expect(mockSetLocationPermission).toHaveBeenCalledWith(true);
  });

  it('sets context locationPermission to false when check returns false on mount', async () => {
    checkSpy.mockResolvedValue(false);

    renderHook(() => useGrantedLocationPermission(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(checkSpy).toHaveBeenCalledWith(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    expect(requestSpy).not.toHaveBeenCalled();
    expect(mockSetLocationPermission).toHaveBeenCalledWith(false);
  });

  it('reads permission again when AppState becomes active (decision 67.5)', async () => {
    checkSpy.mockResolvedValue(true);

    renderHook(() => useGrantedLocationPermission(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(checkSpy).toHaveBeenCalledTimes(1);
    expect(mockSetLocationPermission).toHaveBeenCalledWith(true);

    // Permission was revoked in settings while phone was backgrounded
    checkSpy.mockResolvedValue(false);

    // AppState returns to active
    expect(appStateListener).toBeDefined();
    await act(async () => {
      appStateListener!('active');
      await Promise.resolve();
    });

    expect(checkSpy).toHaveBeenCalledTimes(2);
    expect(mockSetLocationPermission).toHaveBeenCalledWith(false);
  });

  it('does not re-read permission when AppState transitions to background or inactive', async () => {
    renderHook(() => useGrantedLocationPermission(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(checkSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      appStateListener!('background');
      appStateListener!('inactive');
      await Promise.resolve();
    });

    expect(checkSpy).toHaveBeenCalledTimes(1);
  });

  it('removes AppState event listener subscription on unmount', () => {
    const { unmount } = renderHook(() => useGrantedLocationPermission(), {
      wrapper,
    });
    unmount();

    expect(mockSubscriptionRemove).toHaveBeenCalledTimes(1);
  });

  it('useLocationPermission() itself does not call PermissionsAndroid.check or AppState.addEventListener', async () => {
    renderHook(() => useLocationPermission(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(checkSpy).not.toHaveBeenCalled();
    expect(appStateSpy).not.toHaveBeenCalled();
  });

  describe('requestLocationPermission (decision 17.22, Clause 3)', () => {
    let openSettingsSpy: jest.SpyInstance;
    let requestLocationSpy: jest.SpyInstance;

    beforeEach(() => {
      openSettingsSpy = jest
        .spyOn(Linking, 'openSettings')
        .mockResolvedValue(undefined as any);
      requestLocationSpy = jest.spyOn(
        permissionsUtil,
        'requestAndroidLocation',
      );
    });

    afterEach(() => {
      openSettingsSpy.mockRestore();
      requestLocationSpy.mockRestore();
    });

    it('"approximate" returns false and does NOT open settings even with openSettingsIfBlocked', async () => {
      requestLocationSpy.mockResolvedValue('approximate');

      const { result } = renderHook(() => useLocationPermission(), { wrapper });

      let granted: boolean | undefined;
      await act(async () => {
        granted = await result.current.requestLocationPermission({
          openSettingsIfBlocked: true,
        });
      });

      expect(granted).toBe(false);
      expect(openSettingsSpy).not.toHaveBeenCalled();
      expect(mockSetLocationPermission).toHaveBeenCalledWith(false);
    });

    it('"blocked" with openSettingsIfBlocked opens settings via Linking.openSettings and returns false', async () => {
      requestLocationSpy.mockResolvedValue('blocked');

      const { result } = renderHook(() => useLocationPermission(), { wrapper });

      let granted: boolean | undefined;
      await act(async () => {
        granted = await result.current.requestLocationPermission({
          openSettingsIfBlocked: true,
        });
      });

      expect(granted).toBe(false);
      expect(openSettingsSpy).toHaveBeenCalledTimes(1);
      expect(mockSetLocationPermission).toHaveBeenCalledWith(false);
    });

    it('"granted" returns true and does not open settings', async () => {
      requestLocationSpy.mockResolvedValue('granted');

      const { result } = renderHook(() => useLocationPermission(), { wrapper });

      let granted: boolean | undefined;
      await act(async () => {
        granted = await result.current.requestLocationPermission({
          openSettingsIfBlocked: true,
        });
      });

      expect(granted).toBe(true);
      expect(openSettingsSpy).not.toHaveBeenCalled();
      expect(mockSetLocationPermission).toHaveBeenCalledWith(true);
    });
  });
});

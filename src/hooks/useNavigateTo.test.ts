import { Alert, Linking } from 'react-native';
import ActionSheet from 'react-native-action-sheet';
import { renderHook, act } from '@testing-library/react-native';
import { MapLinkingOptions } from '@app/types/types';
import { RoutePoint } from '@app/types/route';
import { mapProbeUrl, mapRouteUrl } from '@app/utilities/mapLinks';
import * as mapPreferences from '@app/services/mapPreferences';
import { installedNavigationApps, useNavigateTo } from './useNavigateTo';
import i18n from '@app/localization/i18n';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('useNavigateTo (spec 0018, AC-12)', () => {
  const destPoint: RoutePoint = { latitude: 39.3622, longitude: 22.9425 };
  let openURLSpy: jest.SpyInstance;
  let canOpenURLSpy: jest.SpyInstance;
  let alertSpy: jest.SpyInstance;
  let getNavigationAppSpy: jest.SpyInstance;
  let setNavigationAppSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    canOpenURLSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true as any);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    getNavigationAppSpy = jest.spyOn(mapPreferences, 'getNavigationApp');
    setNavigationAppSpy = jest.spyOn(mapPreferences, 'setNavigationApp').mockResolvedValue();
  });

  afterEach(() => {
    openURLSpy.mockRestore();
    canOpenURLSpy.mockRestore();
    alertSpy.mockRestore();
    getNavigationAppSpy.mockRestore();
    setNavigationAppSpy.mockRestore();
  });

  describe('installedNavigationApps', () => {
    it('returns only apps whose probe URLs can be opened', async () => {
      canOpenURLSpy.mockImplementation((url: string) => {
        return Promise.resolve(url === mapProbeUrl(MapLinkingOptions.google));
      });

      const installed = await installedNavigationApps();
      expect(installed).toEqual([MapLinkingOptions.google]);
    });
  });

  describe('useNavigateTo hook', () => {
    it('opens saved app straight away with mapRouteUrl and no action sheet when saved app is installed', async () => {
      getNavigationAppSpy.mockResolvedValue(MapLinkingOptions.google);
      canOpenURLSpy.mockResolvedValue(true);

      const { result } = renderHook(() => useNavigateTo());

      await act(async () => {
        await result.current(destPoint);
      });

      expect(Linking.openURL).toHaveBeenCalledWith(
        mapRouteUrl(MapLinkingOptions.google, destPoint),
      );
      expect(ActionSheet.showActionSheetWithOptions).not.toHaveBeenCalled();
      expect(setNavigationAppSpy).not.toHaveBeenCalled();
    });

    it('shows action sheet of installed apps only and saves pick when no app is saved', async () => {
      getNavigationAppSpy.mockResolvedValue(null);
      // Only Google and Waze installed
      canOpenURLSpy.mockImplementation((url: string) => {
        return Promise.resolve(
          url === mapProbeUrl(MapLinkingOptions.google) ||
            url === mapProbeUrl(MapLinkingOptions.waze),
        );
      });

      const { result } = renderHook(() => useNavigateTo());

      await act(async () => {
        await result.current(destPoint);
      });

      expect(ActionSheet.showActionSheetWithOptions).toHaveBeenCalledTimes(1);
      const [config, callback] = (
        ActionSheet.showActionSheetWithOptions as jest.Mock
      ).mock.calls[0];

      // Options: Google, Waze, Cancel
      expect(config.options).toEqual([
        i18n.t(`translations:${MapLinkingOptions.google}`),
        i18n.t(`translations:${MapLinkingOptions.waze}`),
        i18n.t('translations:cancel'),
      ]);

      // Rider picks Waze (index 1)
      await act(async () => {
        callback(1);
      });

      expect(setNavigationAppSpy).toHaveBeenCalledWith(MapLinkingOptions.waze);
      expect(Linking.openURL).toHaveBeenCalledWith(
        mapRouteUrl(MapLinkingOptions.waze, destPoint),
      );
    });

    it('shows action sheet of installed apps and saves pick when saved app is no longer installed', async () => {
      // Saved Waze, but Waze probe returns false, Google returns true
      getNavigationAppSpy.mockResolvedValue(MapLinkingOptions.waze);
      canOpenURLSpy.mockImplementation((url: string) => {
        return Promise.resolve(url === mapProbeUrl(MapLinkingOptions.google));
      });

      const { result } = renderHook(() => useNavigateTo());

      await act(async () => {
        await result.current(destPoint);
      });

      // ActionSheet was opened instead of opening Waze
      expect(ActionSheet.showActionSheetWithOptions).toHaveBeenCalledTimes(1);
      const [config, callback] = (
        ActionSheet.showActionSheetWithOptions as jest.Mock
      ).mock.calls[0];

      expect(config.options).toEqual([
        i18n.t(`translations:${MapLinkingOptions.google}`),
        i18n.t('translations:cancel'),
      ]);

      // Rider picks Google (index 0)
      await act(async () => {
        callback(0);
      });

      expect(setNavigationAppSpy).toHaveBeenCalledWith(MapLinkingOptions.google);
      expect(Linking.openURL).toHaveBeenCalledWith(
        mapRouteUrl(MapLinkingOptions.google, destPoint),
      );
    });

    it('shows an alert and does nothing else when no navigation apps are installed', async () => {
      getNavigationAppSpy.mockResolvedValue(null);
      canOpenURLSpy.mockResolvedValue(false);

      const { result } = renderHook(() => useNavigateTo());

      await act(async () => {
        await result.current(destPoint);
      });

      expect(alertSpy).toHaveBeenCalledWith(
        i18n.t('translations:navigation_app_none'),
      );
      expect(ActionSheet.showActionSheetWithOptions).not.toHaveBeenCalled();
      expect(Linking.openURL).not.toHaveBeenCalled();
    });
  });
});

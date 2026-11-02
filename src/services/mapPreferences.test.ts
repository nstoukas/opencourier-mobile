import AsyncStorage from '@react-native-async-storage/async-storage';
import { MapLinkingOptions } from '@app/types/types';
import {
  getNavigationApp,
  getRestaurantLayerChoice,
  NAVIGATION_APP_KEY,
  RESTAURANT_LAYER_KEY,
  setNavigationApp,
  setRestaurantLayerChoice,
} from './mapPreferences';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('mapPreferences (spec 0018, AC-11, AC-12)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('restaurant layer preference (AC-11)', () => {
    it('saves "on" when true and "off" when false', async () => {
      await setRestaurantLayerChoice(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(RESTAURANT_LAYER_KEY, 'on');
      expect(await getRestaurantLayerChoice()).toBe('on');

      await setRestaurantLayerChoice(false);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(RESTAURANT_LAYER_KEY, 'off');
      expect(await getRestaurantLayerChoice()).toBe('off');
    });

    it('reads anything other than "on" or "off" as null', async () => {
      expect(await getRestaurantLayerChoice()).toBeNull();

      await AsyncStorage.setItem(RESTAURANT_LAYER_KEY, 'invalid_choice');
      expect(await getRestaurantLayerChoice()).toBeNull();

      await AsyncStorage.setItem(RESTAURANT_LAYER_KEY, 'true');
      expect(await getRestaurantLayerChoice()).toBeNull();
    });

    it('returns null when AsyncStorage getItem fails', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage failure'));
      expect(await getRestaurantLayerChoice()).toBeNull();
    });
  });

  describe('navigation app preference (AC-12)', () => {
    it('stores "google", "waze", "apple" and reads back the matching MapLinkingOptions', async () => {
      await setNavigationApp(MapLinkingOptions.google);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(NAVIGATION_APP_KEY, 'google');
      expect(await getNavigationApp()).toBe(MapLinkingOptions.google);

      await setNavigationApp(MapLinkingOptions.waze);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(NAVIGATION_APP_KEY, 'waze');
      expect(await getNavigationApp()).toBe(MapLinkingOptions.waze);

      await setNavigationApp(MapLinkingOptions.apple);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(NAVIGATION_APP_KEY, 'apple');
      expect(await getNavigationApp()).toBe(MapLinkingOptions.apple);
    });

    it('removes the navigation_app key when app is null', async () => {
      await setNavigationApp(MapLinkingOptions.google);
      expect(await getNavigationApp()).toBe(MapLinkingOptions.google);

      await setNavigationApp(null);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(NAVIGATION_APP_KEY);
      expect(await getNavigationApp()).toBeNull();
    });

    it('reads an unknown stored value as null', async () => {
      await AsyncStorage.setItem(NAVIGATION_APP_KEY, 'unsupported_app');
      expect(await getNavigationApp()).toBeNull();
    });

    it('returns null when AsyncStorage getItem fails', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));
      expect(await getNavigationApp()).toBeNull();
    });
  });
});

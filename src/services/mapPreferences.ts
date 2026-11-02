import AsyncStorage from '@react-native-async-storage/async-storage';
import { MapLinkingOptions } from '@app/types/types';

// Spec 0018: two choices a rider makes on this phone, kept on the phone.
export const RESTAURANT_LAYER_KEY = 'map_restaurant_layer';
export const NAVIGATION_APP_KEY = 'navigation_app';

// The saved names, as the spec writes them, and the app each one opens.
const NAVIGATION_APPS: Record<string, MapLinkingOptions> = {
  google: MapLinkingOptions.google,
  waze: MapLinkingOptions.waze,
  apple: MapLinkingOptions.apple,
};

export const getRestaurantLayerChoice = async (): Promise<
  'on' | 'off' | null
> => {
  const value = await AsyncStorage.getItem(RESTAURANT_LAYER_KEY).catch(
    () => null,
  );
  return value === 'on' || value === 'off' ? value : null;
};

export const setRestaurantLayerChoice = async (on: boolean) => {
  await AsyncStorage.setItem(RESTAURANT_LAYER_KEY, on ? 'on' : 'off');
};

export const getNavigationApp = async (): Promise<MapLinkingOptions | null> => {
  const value = await AsyncStorage.getItem(NAVIGATION_APP_KEY).catch(
    () => null,
  );
  return value !== null && value in NAVIGATION_APPS
    ? NAVIGATION_APPS[value]
    : null;
};

// `null` clears the choice: Navigate asks every time again.
export const setNavigationApp = async (app: MapLinkingOptions | null) => {
  if (app === null) {
    await AsyncStorage.removeItem(NAVIGATION_APP_KEY);
    return;
  }
  const name = Object.keys(NAVIGATION_APPS).find(
    key => NAVIGATION_APPS[key] === app,
  );
  if (name !== undefined) {
    await AsyncStorage.setItem(NAVIGATION_APP_KEY, name);
  }
};

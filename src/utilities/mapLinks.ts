import { Platform } from 'react-native';
import { MapLinkingOptions } from '@app/types/types';

type Point = { latitude: number; longitude: number };
// `typeof Platform.OS` is the type of that value: 'android', 'ios' and the other platforms.
type OS = typeof Platform.OS;

// The map apps a rider can pick on this platform, in the order the sheet lists
// them. Apple Maps exists only on iOS.
export const mapAppsFor = (os: OS = Platform.OS): MapLinkingOptions[] =>
  os === 'ios'
    ? [
        MapLinkingOptions.apple,
        MapLinkingOptions.google,
        MapLinkingOptions.waze,
      ]
    : [MapLinkingOptions.google, MapLinkingOptions.waze];

// A URL the app answers to, used only to ask the phone whether it is installed.
// On Android 11 and later the answer is always "no" unless the manifest's
// <queries> names the same scheme (row 66).
export const mapProbeUrl = (
  app: MapLinkingOptions,
  os: OS = Platform.OS,
): string => {
  switch (app) {
    case MapLinkingOptions.apple:
      return 'maps://';
    case MapLinkingOptions.google:
      return os === 'android' ? 'google.navigation:q=0,0' : 'comgooglemaps://';
    case MapLinkingOptions.waze:
      return 'waze://';
  }
};

// The URL that opens `app` with a route to `point`, the place the rider tapped
// (the restaurant or the customer).
export const mapRouteUrl = (
  app: MapLinkingOptions,
  point: Point,
  os: OS = Platform.OS,
): string => {
  const latLng = `${point.latitude},${point.longitude}`;
  switch (app) {
    case MapLinkingOptions.apple:
      return `maps://?daddr=${latLng}`;
    case MapLinkingOptions.google:
      return os === 'android'
        ? `google.navigation:q=${latLng}`
        : `comgooglemaps://?daddr=${latLng}&directionsmode=driving`;
    case MapLinkingOptions.waze:
      return `waze://?ll=${latLng}&navigate=yes`;
  }
};

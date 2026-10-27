import { MapLinkingOptions } from '@app/types/types';
import { mapAppsFor, mapProbeUrl, mapRouteUrl } from './mapLinks';

describe('mapLinks (Row 66, Clause 1 & Clause 2)', () => {
  const testPoint = { latitude: 39.3611, longitude: 22.9425 };

  describe('mapAppsFor', () => {
    it('offers Apple Maps, Google Maps, and Waze on iOS in that order', () => {
      const apps = mapAppsFor('ios');
      expect(apps).toEqual([
        MapLinkingOptions.apple,
        MapLinkingOptions.google,
        MapLinkingOptions.waze,
      ]);
    });

    it('offers only Google Maps and Waze on Android (Apple Maps is iOS only)', () => {
      const apps = mapAppsFor('android');
      expect(apps).toEqual([MapLinkingOptions.google, MapLinkingOptions.waze]);
      expect(apps).not.toContain(MapLinkingOptions.apple);
    });
  });

  describe('mapProbeUrl', () => {
    it('probes google.navigation on Android (not comgooglemaps, required for Android 11+)', () => {
      expect(mapProbeUrl(MapLinkingOptions.google, 'android')).toBe(
        'google.navigation:q=0,0',
      );
    });

    it('probes comgooglemaps on iOS for Google Maps', () => {
      expect(mapProbeUrl(MapLinkingOptions.google, 'ios')).toBe(
        'comgooglemaps://',
      );
    });

    it('probes waze:// on both android and ios', () => {
      expect(mapProbeUrl(MapLinkingOptions.waze, 'android')).toBe('waze://');
      expect(mapProbeUrl(MapLinkingOptions.waze, 'ios')).toBe('waze://');
    });

    it('probes maps:// for Apple Maps', () => {
      expect(mapProbeUrl(MapLinkingOptions.apple, 'ios')).toBe('maps://');
      expect(mapProbeUrl(MapLinkingOptions.apple, 'android')).toBe('maps://');
    });
  });

  describe('mapRouteUrl', () => {
    it('creates Android Google Maps navigation route URL with google.navigation:q=LAT,LNG', () => {
      const url = mapRouteUrl(MapLinkingOptions.google, testPoint, 'android');
      expect(url).toBe('google.navigation:q=39.3611,22.9425');
    });

    it('creates iOS Google Maps route URL with comgooglemaps://?daddr=LAT,LNG&directionsmode=driving', () => {
      const url = mapRouteUrl(MapLinkingOptions.google, testPoint, 'ios');
      expect(url).toBe(
        'comgooglemaps://?daddr=39.3611,22.9425&directionsmode=driving',
      );
    });

    it('creates Waze route URL with waze://?ll=LAT,LNG&navigate=yes', () => {
      const androidUrl = mapRouteUrl(
        MapLinkingOptions.waze,
        testPoint,
        'android',
      );
      const iosUrl = mapRouteUrl(MapLinkingOptions.waze, testPoint, 'ios');
      expect(androidUrl).toBe('waze://?ll=39.3611,22.9425&navigate=yes');
      expect(iosUrl).toBe('waze://?ll=39.3611,22.9425&navigate=yes');
    });

    it('creates Apple Maps route URL with maps://?daddr=LAT,LNG', () => {
      const url = mapRouteUrl(MapLinkingOptions.apple, testPoint, 'ios');
      expect(url).toBe('maps://?daddr=39.3611,22.9425');
    });
  });
});

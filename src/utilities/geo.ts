import { kmNumber } from './locale';
import { Point } from 'geojson';
import Geolocation from 'react-native-geolocation-service';
import { WatchOptions } from './locationTracking';

// What else the phone knows about a fix (spec 0021): how accurate it rated it,
// in metres (null when it gave no figure), and when it was handled on the
// phone's own clock (`Date.now()`, never the GPS timestamp).
export type FixInfo = { accuracyMetres: number | null; at: number };

// Starts one location watch with these options and returns its id (stop it
// with Geolocation.clearWatch). The first fix is asked for at once, so the
// server has a position before the phone has moved.
// `onError` (row 156) hears the library's error code, so the caller can tell location switched off
// from a fix that only took too long; every error is still written to the console as before.
export function track(
  onUpdate: (point: Point, info: FixInfo) => void,
  options: WatchOptions,
  onError?: (code: number) => void,
): number {
  const toPoint = (latitude: number, longitude: number): Point => ({
    type: 'Point',
    coordinates: [longitude, latitude],
  });
  // `Geolocation.GeoPosition` is the library's type for one fix.
  const handle = (position: Geolocation.GeoPosition) =>
    onUpdate(toPoint(position.coords.latitude, position.coords.longitude), {
      accuracyMetres:
        typeof position.coords.accuracy === 'number'
          ? position.coords.accuracy
          : null,
      at: Date.now(),
    });
  // `Geolocation.GeoError` is the library's type for a failed read.
  const handleError = (error: Geolocation.GeoError) => {
    console.error('Location error: ', error);
    onError?.(error.code);
  };
  Geolocation.getCurrentPosition(
    handle,
    handleError,
    // See https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition for
    // details on options. The first read is always high accuracy, on purpose:
    // the server should start from a good position.
    // Row 156 review: `showLocationDialog: false`, so Google's "turn on location" dialog never opens by
    // itself (it would open again on every return to the app while the rider says no). Home's banner is
    // the one prompt, and its button opens the phone's settings.
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
      showLocationDialog: false,
    },
  );
  return Geolocation.watchPosition(handle, handleError, {
    ...options,
    // Row 156 review: never the system dialog (see above).
    showLocationDialog: false,
    // iOS shows its blue location bar while the app tracks in the
    // background (row 68); Android shows the "online" notification instead.
    showsBackgroundLocationIndicator: true,
  });
}

// Metres as "1,2 km" in Greek, "1.2 km" in English (one decimal, through kmNumber).
export function formatDistance(meters: number): string {
  return `${kmNumber(meters / 1000)} km`;
}

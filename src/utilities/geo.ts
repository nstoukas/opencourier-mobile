import { APP_LOCALE } from './locale';
import { Point } from 'geojson';
import Geolocation from 'react-native-geolocation-service';
import { WatchOptions } from './locationTracking';

// Starts one location watch with these options and returns its id (stop it
// with Geolocation.clearWatch). The first fix is asked for at once, so the
// server has a position before the phone has moved.
export function track(
  onUpdate: (point: Point) => void,
  options: WatchOptions,
): number {
  const toPoint = (latitude: number, longitude: number): Point => ({
    type: 'Point',
    coordinates: [longitude, latitude],
  });
  Geolocation.getCurrentPosition(
    position =>
      onUpdate(toPoint(position.coords.latitude, position.coords.longitude)),
    error => console.error('Location error: ', error),
    // See https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition for
    // details on options. The first read is always high accuracy, on purpose:
    // the server should start from a good position.
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
  );
  return Geolocation.watchPosition(
    position =>
      onUpdate(toPoint(position.coords.latitude, position.coords.longitude)),
    error => console.error('Location error: ', error),
    {
      ...options,
      // iOS shows its blue location bar while the app tracks in the
      // background (row 68); Android shows the "online" notification instead.
      showsBackgroundLocationIndicator: true,
    },
  );
}

export function formatDistance(meters: number): string {
  const km = new Intl.NumberFormat(APP_LOCALE, {
    maximumFractionDigits: 1,
  }).format(meters / 1000);
  return `${km} km`;
}

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

// TODO: Add functionality to configure mode of transporation for getDistance
export async function getDistance(coordinates: number[][]) {
  const url =
    'http://router.project-osrm.org/route/v1/driving/' + coordinates.join(';');
  return await fetch(url)
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {
        console.log(response.body);
      }
    })
    .then(json => {
      console.log(json);
      return {
        duration: json.routes[0].duration,
        distance: json.routes[0].distance,
      };
    })
    .catch(function (error) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.log(error.response.data);
        console.log(error.response.status);
        console.log(error.response.headers);
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log(error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log('Error', error.message);
      }
      console.log(error.config);
      return { duration: 0, distance: 0 };
    });
}

// A distance for a rider to read, in km with one decimal ("2.4 km").
export function formatDistance(meters: number): string {
  const km = new Intl.NumberFormat(APP_LOCALE, {
    maximumFractionDigits: 1,
  }).format(meters / 1000);
  return `${km} km`;
}

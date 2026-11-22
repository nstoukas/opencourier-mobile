import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// How long a map pin keeps redrawing itself after its look changes. Long
// enough for its icon and text to be drawn, even on a slow phone; after that
// Android keeps the last picture it took.
export const TRACK_FOR_MS = 1000;

// Row 125: on Android, a react-native-maps Marker with children takes a new
// picture of those children about 25 times a second for as long as its
// `tracksViewChanges` is on (the default). Left on, the pictures pile up and the
// app runs out of memory after about 25 minutes. This answers "should the pin
// track right now?": yes for a short while after it first appears, after each
// change of `lookKey` and after the app comes back to the front; no otherwise,
// and never while the app is in the background.
//
// `lookKey` is a string that changes exactly when the pin's look changes (its
// number, whether it is done). Moving the pin is not a change of look: the
// coordinate is not part of the picture.
export const useTrackOnce = (lookKey: string): boolean => {
  const [tracking, setTracking] = useState(true);
  // Counts each return of the app to the front, so the effect below runs again.
  const [frontCount, setFrontCount] = useState(0);

  // While the app is in the background (the rider is in Google Maps, say),
  // JavaScript timers stop but Android's picture taking does not, so a pin whose
  // look changed there would track until the app came back (review of row 125).
  // Stop at once on leaving; take a fresh picture on return.
  useEffect(() => {
    // AppState tells us when the app goes to the background and comes back.
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setFrontCount(count => count + 1);
      } else {
        setTracking(false);
      }
    });
    return () => subscription.remove();
  }, []);

  // `useEffect` with `[lookKey, frontCount]` runs after the first draw and again
  // after each draw where either changed. The function it returns runs before
  // the next run and when the pin leaves the screen, so no timer outlives its pin.
  useEffect(() => {
    if (AppState.currentState !== 'active' && AppState.currentState != null) {
      setTracking(false);
      return;
    }
    setTracking(true);
    const timer = setTimeout(() => setTracking(false), TRACK_FOR_MS);
    return () => clearTimeout(timer);
  }, [lookKey, frontCount]);

  return tracking;
};

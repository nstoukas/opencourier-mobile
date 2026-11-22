import { useEffect, useState } from 'react';

// How long a map pin keeps redrawing itself after its look changes. Long
// enough for its icon and text to be drawn, even on a slow phone; after that
// Android keeps the last picture it took.
export const TRACK_FOR_MS = 1000;

// Row 125: on Android, a react-native-maps Marker with children takes a new
// picture of those children about 25 times a second for as long as its
// `tracksViewChanges` is on (the default). Left on, the pictures pile up and the
// app runs out of memory after about 25 minutes. This answers "should the pin
// track right now?": yes for a short while after it first appears and after
// each change of `lookKey`, no otherwise.
//
// `lookKey` is a string that changes exactly when the pin's look changes (its
// number, whether it is done, the map becoming ready). Moving the pin is not a
// change of look: the coordinate is not part of the picture.
export const useTrackOnce = (lookKey: string): boolean => {
  const [tracking, setTracking] = useState(true);

  // `useEffect` with `[lookKey]` runs after the first draw and again after each
  // draw where `lookKey` changed. The function it returns runs before the next
  // run and when the pin leaves the screen, so no timer outlives its pin.
  useEffect(() => {
    setTracking(true);
    const timer = setTimeout(() => setTracking(false), TRACK_FOR_MS);
    return () => clearTimeout(timer);
  }, [lookKey]);

  return tracking;
};

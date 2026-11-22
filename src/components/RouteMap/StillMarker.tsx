import React from 'react';
import { Marker, MapMarkerProps } from 'react-native-maps';
import { useTrackOnce } from '@app/hooks/useTrackOnce';

// `&` joins two types: every prop a Marker takes, plus our own `lookKey`.
type Props = MapMarkerProps & {
  // Changes exactly when what the pin shows changes (see `useTrackOnce`).
  lookKey: string;
};

// Row 125: a Marker with a custom look (children) that redraws its picture only
// for a moment after it appears or its look changes, never all the time. Every
// pin with children on a map in this app goes through here.
export const StillMarker = ({ lookKey, children, ...markerProps }: Props) => {
  const tracking = useTrackOnce(lookKey);
  return (
    // `{...markerProps}` passes on every other prop (coordinate, testID, anchor) unchanged.
    <Marker {...markerProps} tracksViewChanges={tracking}>
      {children}
    </Marker>
  );
};

import React from 'react';
import { AppState } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { View } from 'react-native';
import { StillMarker } from './StillMarker';
import { TRACK_FOR_MS } from '@app/hooks/useTrackOnce';
import { Marker } from 'react-native-maps';

describe('StillMarker (row 125, decision 125.1, 125.2)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    AppState.currentState = 'active';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders a Marker whose tracksViewChanges is true initially and false after TRACK_FOR_MS', () => {
    const { UNSAFE_getByType } = render(
      <StillMarker
        lookKey="test-pin"
        coordinate={{ latitude: 39.36, longitude: 22.94 }}
        testID="still-pin">
        <View testID="custom-pin-child" />
      </StillMarker>,
    );

    const marker = UNSAFE_getByType(Marker);
    expect(marker.props.tracksViewChanges).toBe(true);
    expect(marker.props.coordinate).toEqual({
      latitude: 39.36,
      longitude: 22.94,
    });

    act(() => {
      jest.advanceTimersByTime(TRACK_FOR_MS);
    });

    expect(marker.props.tracksViewChanges).toBe(false);
  });
});

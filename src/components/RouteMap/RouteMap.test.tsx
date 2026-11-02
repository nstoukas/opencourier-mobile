import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MapView from 'react-native-maps';
import '@app/localization/i18n';
import { RouteMap } from './RouteMap';
import { PickupPoint, RouteLeg, RouteLegKind, RoutePoint } from '@app/types/route';

describe('RouteMap (spec 0018, AC-5, AC-6, AC-11)', () => {
  const mockFitToCoordinates = (MapView as any).fitToCoordinates;
  const mockAnimateToRegion = (MapView as any).animateToRegion;

  const ownPos: RoutePoint = { latitude: 39.3622, longitude: 22.9425 };
  const pickupPos: RoutePoint = { latitude: 39.365, longitude: 22.945 };
  const dropoffPos: RoutePoint = { latitude: 39.37, longitude: 22.95 };

  const sampleLegs: RouteLeg[] = [
    {
      kind: RouteLegKind.RiderToPickup,
      distanceMetres: 800,
      durationSeconds: 120,
      points: [ownPos, pickupPos],
    },
    {
      kind: RouteLegKind.PickupToDropoff,
      distanceMetres: 1200,
      durationSeconds: 200,
      points: [pickupPos, dropoffPos],
    },
  ];

  const pickupPoints: PickupPoint[] = [
    { id: 'rest-1', name: 'Souvlaki Palace', latitude: 39.363, longitude: 22.943 },
    { id: 'rest-2', name: 'Pizza Roma', latitude: 39.367, longitude: 22.947 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('draws a Polyline per leg with route-leg-<KIND> testID, pickup and dropoff pins, and showsUserLocation is false', () => {
    const { getByTestId, UNSAFE_getByType } = render(
      <RouteMap
        legs={sampleLegs}
        pickup={pickupPos}
        dropoff={dropoffPos}
        ownPosition={ownPos}
        restaurantLayerOn={false}
        pickupPoints={pickupPoints}
        onToggleRestaurantLayer={jest.fn()}
        fitKey="order-1-ACCEPTED"
        bottomInset={100}
      />,
    );

    // showsUserLocation is false
    const mapView = UNSAFE_getByType(MapView);
    expect(mapView.props.showsUserLocation).toBe(false);

    // Polylines
    expect(getByTestId(`route-leg-${RouteLegKind.RiderToPickup}`)).toBeTruthy();
    expect(getByTestId(`route-leg-${RouteLegKind.PickupToDropoff}`)).toBeTruthy();

    // Pins
    expect(getByTestId('pickup-pin')).toBeTruthy();
    expect(getByTestId('dropoff-pin')).toBeTruthy();
    expect(getByTestId('rider-marker')).toBeTruthy();
  });

  it('draws rider marker only when ownPosition is provided', () => {
    const { queryByTestId, rerender } = render(
      <RouteMap
        legs={[]}
        ownPosition={null}
        restaurantLayerOn={false}
        pickupPoints={[]}
        onToggleRestaurantLayer={jest.fn()}
        fitKey="none-"
        bottomInset={0}
      />,
    );

    expect(queryByTestId('rider-marker')).toBeNull();

    rerender(
      <RouteMap
        legs={[]}
        ownPosition={ownPos}
        restaurantLayerOn={false}
        pickupPoints={[]}
        onToggleRestaurantLayer={jest.fn()}
        fitKey="none-"
        bottomInset={0}
      />,
    );

    expect(queryByTestId('rider-marker')).toBeTruthy();
  });

  it('draws restaurant pins only when restaurantLayerOn is true', () => {
    const { queryByTestId, getByTestId, rerender } = render(
      <RouteMap
        legs={[]}
        ownPosition={ownPos}
        restaurantLayerOn={false}
        pickupPoints={pickupPoints}
        onToggleRestaurantLayer={jest.fn()}
        fitKey="none-"
        bottomInset={0}
      />,
    );

    expect(queryByTestId('restaurant-pin-rest-1')).toBeNull();
    expect(queryByTestId('restaurant-pin-rest-2')).toBeNull();

    rerender(
      <RouteMap
        legs={[]}
        ownPosition={ownPos}
        restaurantLayerOn={true}
        pickupPoints={pickupPoints}
        onToggleRestaurantLayer={jest.fn()}
        fitKey="none-"
        bottomInset={0}
      />,
    );

    expect(getByTestId('restaurant-pin-rest-1')).toBeTruthy();
    expect(getByTestId('restaurant-pin-rest-2')).toBeTruthy();
  });

  it('runs fit (fitToCoordinates) once per fitKey and does not run again when only legs change', () => {
    const { rerender } = render(
      <RouteMap
        legs={sampleLegs}
        pickup={pickupPos}
        dropoff={dropoffPos}
        ownPosition={ownPos}
        restaurantLayerOn={false}
        pickupPoints={[]}
        onToggleRestaurantLayer={jest.fn()}
        fitKey="order-1-ACCEPTED"
        bottomInset={100}
      />,
    );

    // Initial fit ran
    expect(mockFitToCoordinates).toHaveBeenCalledTimes(1);

    // Legs change with the same fitKey (e.g. minute refetch of route)
    const updatedLegs: RouteLeg[] = [
      {
        ...sampleLegs[0],
        durationSeconds: 100,
      },
    ];

    rerender(
      <RouteMap
        legs={updatedLegs}
        pickup={pickupPos}
        dropoff={dropoffPos}
        ownPosition={ownPos}
        restaurantLayerOn={false}
        pickupPoints={[]}
        onToggleRestaurantLayer={jest.fn()}
        fitKey="order-1-ACCEPTED"
        bottomInset={100}
      />,
    );

    // fitToCoordinates must NOT be called again
    expect(mockFitToCoordinates).toHaveBeenCalledTimes(1);

    // When fitKey changes (e.g. status transition to PICKED_UP), fit runs again
    rerender(
      <RouteMap
        legs={updatedLegs}
        pickup={pickupPos}
        dropoff={dropoffPos}
        ownPosition={ownPos}
        restaurantLayerOn={false}
        pickupPoints={[]}
        onToggleRestaurantLayer={jest.fn()}
        fitKey="order-1-PICKED_UP"
        bottomInset={100}
      />,
    );

    expect(mockFitToCoordinates).toHaveBeenCalledTimes(2);
  });

  it('recentre button runs frame again', () => {
    const { getByTestId } = render(
      <RouteMap
        legs={sampleLegs}
        pickup={pickupPos}
        dropoff={dropoffPos}
        ownPosition={ownPos}
        restaurantLayerOn={false}
        pickupPoints={[]}
        onToggleRestaurantLayer={jest.fn()}
        fitKey="order-1-ACCEPTED"
        bottomInset={100}
      />,
    );

    expect(mockFitToCoordinates).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId('map-recentre-button'));
    expect(mockFitToCoordinates).toHaveBeenCalledTimes(2);
  });

  it('layers button calls onToggleRestaurantLayer', () => {
    const onToggleMock = jest.fn();

    const { getByTestId } = render(
      <RouteMap
        legs={[]}
        ownPosition={ownPos}
        restaurantLayerOn={false}
        pickupPoints={[]}
        onToggleRestaurantLayer={onToggleMock}
        fitKey="none-"
        bottomInset={0}
      />,
    );

    fireEvent.press(getByTestId('map-layers-button'));
    expect(onToggleMock).toHaveBeenCalledTimes(1);
  });
});

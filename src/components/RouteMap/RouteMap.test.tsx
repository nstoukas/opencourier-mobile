import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import MapView from 'react-native-maps';
import '@app/localization/i18n';
import { RouteMap } from './RouteMap';
import { PickupPoint, RouteLeg, RouteLegKind, RoutePoint } from '@app/types/route';

let mockMapReadyAutoFire = true;

jest.mock('react-native-maps', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  const MockMapView: any = mockReact.forwardRef((props: any, ref: any) => {
    mockReact.useImperativeHandle(ref, () => ({
      fitToCoordinates: MockMapView.fitToCoordinates,
      animateToRegion: MockMapView.animateToRegion,
    }));
    const { onMapReady } = props;
    mockReact.useEffect(() => {
      if (mockMapReadyAutoFire) {
        onMapReady?.();
      }
    }, [onMapReady]);
    return mockReact.createElement(View, props);
  });
  (MockMapView as any).fitToCoordinates = jest.fn();
  (MockMapView as any).animateToRegion = jest.fn();
  const MockMarker = (props: any) => mockReact.createElement(View, props);
  const MockPolyline = (props: any) => mockReact.createElement(View, props);
  const MockCallout = (props: any) => mockReact.createElement(View, props);
  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
    Polyline: MockPolyline,
    Callout: MockCallout,
  };
});

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
    mockMapReadyAutoFire = true;
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

  it('does not fit before onMapReady is called, and fits after onMapReady is called', () => {
    mockMapReadyAutoFire = false;
    const { UNSAFE_getByType } = render(
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

    expect(mockFitToCoordinates).not.toHaveBeenCalled();

    const mapView = UNSAFE_getByType(MapView);
    act(() => {
      mapView.props.onMapReady();
    });

    expect(mockFitToCoordinates).toHaveBeenCalledTimes(1);
  });

  it('with a job, fits again when legs first become non empty, when bottomInset first becomes > 0, and when own position first appears, but NOT again when only legs contents change for the same fitKey', () => {
    const { rerender } = render(
      <RouteMap
        legs={[]}
        pickup={pickupPos}
        dropoff={dropoffPos}
        ownPosition={null}
        restaurantLayerOn={false}
        pickupPoints={[]}
        onToggleRestaurantLayer={jest.fn()}
        fitKey="order-1-ACCEPTED"
        bottomInset={0}
      />,
    );

    // 1. Initial fit runs on mount
    expect(mockFitToCoordinates).toHaveBeenCalledTimes(1);

    // 2. bottomInset first becomes above 0: fit runs again
    rerender(
      <RouteMap
        legs={[]}
        pickup={pickupPos}
        dropoff={dropoffPos}
        ownPosition={null}
        restaurantLayerOn={false}
        pickupPoints={[]}
        onToggleRestaurantLayer={jest.fn()}
        fitKey="order-1-ACCEPTED"
        bottomInset={100}
      />,
    );
    expect(mockFitToCoordinates).toHaveBeenCalledTimes(2);

    // Changes to bottomInset while already > 0 do NOT refit
    rerender(
      <RouteMap
        legs={[]}
        pickup={pickupPos}
        dropoff={dropoffPos}
        ownPosition={null}
        restaurantLayerOn={false}
        pickupPoints={[]}
        onToggleRestaurantLayer={jest.fn()}
        fitKey="order-1-ACCEPTED"
        bottomInset={120}
      />,
    );
    expect(mockFitToCoordinates).toHaveBeenCalledTimes(2);

    // 3. legs first become non empty: fit runs again
    rerender(
      <RouteMap
        legs={sampleLegs}
        pickup={pickupPos}
        dropoff={dropoffPos}
        ownPosition={null}
        restaurantLayerOn={false}
        pickupPoints={[]}
        onToggleRestaurantLayer={jest.fn()}
        fitKey="order-1-ACCEPTED"
        bottomInset={120}
      />,
    );
    expect(mockFitToCoordinates).toHaveBeenCalledTimes(3);

    // When only legs contents change for the same fitKey: does NOT fit again
    const updatedLegs: RouteLeg[] = [
      {
        ...sampleLegs[0],
        durationSeconds: 99,
      },
    ];
    rerender(
      <RouteMap
        legs={updatedLegs}
        pickup={pickupPos}
        dropoff={dropoffPos}
        ownPosition={null}
        restaurantLayerOn={false}
        pickupPoints={[]}
        onToggleRestaurantLayer={jest.fn()}
        fitKey="order-1-ACCEPTED"
        bottomInset={120}
      />,
    );
    expect(mockFitToCoordinates).toHaveBeenCalledTimes(3);

    // 4. own position first appears: fit runs again
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
        bottomInset={120}
      />,
    );
    expect(mockFitToCoordinates).toHaveBeenCalledTimes(4);

    // When position coordinates update: does NOT fit again
    rerender(
      <RouteMap
        legs={updatedLegs}
        pickup={pickupPos}
        dropoff={dropoffPos}
        ownPosition={{ latitude: 39.3623, longitude: 22.9426 }}
        restaurantLayerOn={false}
        pickupPoints={[]}
        onToggleRestaurantLayer={jest.fn()}
        fitKey="order-1-ACCEPTED"
        bottomInset={120}
      />,
    );
    expect(mockFitToCoordinates).toHaveBeenCalledTimes(4);

    // When fitKey changes (e.g. status transition to PICKED_UP), fit runs again
    rerender(
      <RouteMap
        legs={updatedLegs}
        pickup={pickupPos}
        dropoff={dropoffPos}
        ownPosition={{ latitude: 39.3623, longitude: 22.9426 }}
        restaurantLayerOn={false}
        pickupPoints={[]}
        onToggleRestaurantLayer={jest.fn()}
        fitKey="order-1-PICKED_UP"
        bottomInset={120}
      />,
    );
    expect(mockFitToCoordinates).toHaveBeenCalledTimes(5);
  });

  it('with no job and no own position, fits pickup points once they arrive', () => {
    const { rerender } = render(
      <RouteMap
        legs={[]}
        pickup={undefined}
        dropoff={undefined}
        ownPosition={null}
        restaurantLayerOn={false}
        pickupPoints={[]}
        onToggleRestaurantLayer={jest.fn()}
        fitKey="none-"
        bottomInset={0}
      />,
    );

    // Initial mount with no job and no own position falls back to animateToRegion
    expect(mockFitToCoordinates).not.toHaveBeenCalled();
    expect(mockAnimateToRegion).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 39.3622, longitude: 22.9425 }),
    );

    // Pickup points arrive: fits them
    rerender(
      <RouteMap
        legs={[]}
        pickup={undefined}
        dropoff={undefined}
        ownPosition={null}
        restaurantLayerOn={false}
        pickupPoints={pickupPoints}
        onToggleRestaurantLayer={jest.fn()}
        fitKey="none-"
        bottomInset={0}
      />,
    );

    expect(mockFitToCoordinates).toHaveBeenCalledTimes(1);
    expect(mockFitToCoordinates).toHaveBeenCalledWith(
      pickupPoints,
      expect.objectContaining({ animated: true }),
    );
  });

  it('map buttons bottom follows bottomInset', () => {
    const { getByTestId, rerender } = render(
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

    const findButtonsContainer = (root: any) => {
      let node = root;
      while (
        node &&
        (!node.props?.style ||
          !Array.isArray(node.props.style) ||
          !node.props.style.some((s: any) => s && typeof s === 'object' && 'bottom' in s))
      ) {
        node = node.parent;
      }
      return node;
    };

    const container0 = findButtonsContainer(getByTestId('map-layers-button'));
    expect(container0?.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ bottom: 16 })]),
    );

    rerender(
      <RouteMap
        legs={[]}
        ownPosition={ownPos}
        restaurantLayerOn={false}
        pickupPoints={[]}
        onToggleRestaurantLayer={jest.fn()}
        fitKey="none-"
        bottomInset={120}
      />,
    );

    const container120 = findButtonsContainer(getByTestId('map-layers-button'));
    expect(container120?.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ bottom: 136 })]),
    );
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

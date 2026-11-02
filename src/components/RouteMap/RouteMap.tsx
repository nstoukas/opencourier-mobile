import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker, Polyline } from 'react-native-maps';
import { useTranslation } from 'react-i18next';
import {
  color,
  control,
  radius,
  shadow,
  space,
  typeScale,
  withAlpha,
} from '@app/styles/theme';
import { Icon } from '@app/components/Icon/Icon';
import { StackIcon } from 'phosphor-react-native/src/icons/Stack';
import { CrosshairIcon } from 'phosphor-react-native/src/icons/Crosshair';
import { StorefrontIcon } from 'phosphor-react-native/src/icons/Storefront';
import { HouseLineIcon } from 'phosphor-react-native/src/icons/HouseLine';
import { PickupPoint, RouteLeg, RoutePoint } from '@app/types/route';
import { FALLBACK_CENTRE, isRiderLeg } from '@app/utilities/routeLegs';

type Props = {
  // The legs to draw, already filtered by `visibleLegs` (spec 0018, AC-6).
  legs: RouteLeg[];
  // The pins of the offer or job in the card; none when the card has nothing.
  pickup?: RoutePoint;
  dropoff?: RoutePoint;
  // The phone's own newest position (AC-5); never the server's copy.
  ownPosition: RoutePoint | null;
  // The restaurant layer (AC-11).
  restaurantLayerOn: boolean;
  pickupPoints: PickupPoint[];
  onToggleRestaurantLayer: () => void;
  // Changes when the view should fit again: the delivery id and its server
  // status. Later refetches of the same key only swap the lines (AC-6).
  fitKey: string;
  // Room the bottom card takes, so the fit keeps the route above it.
  bottomInset: number;
};

const ZOOMED_IN = { latitudeDelta: 0.02, longitudeDelta: 0.02 };
const EDGE = 48;

// Spec 0018: the full screen map behind home. It draws the rider (from the
// phone), the restaurant and customer pins, each route leg, and, when on, a
// pin per restaurant. It never asks a routing server: the legs come in as props.
export const RouteMap = ({
  legs,
  pickup,
  dropoff,
  ownPosition,
  restaurantLayerOn,
  pickupPoints,
  onToggleRestaurantLayer,
  fitKey,
  bottomInset,
}: Props) => {
  const { t } = useTranslation();
  // `useRef` holds the map itself, so the fit and recentre can move it.
  const mapRef = useRef<MapView>(null);

  // Everything worth having in view, in priority order of what exists.
  const fitPoints = useMemo<RoutePoint[]>(() => {
    const points: RoutePoint[] = [];
    if (ownPosition) {
      points.push(ownPosition);
    }
    if (pickup) {
      points.push(pickup);
    }
    if (dropoff) {
      points.push(dropoff);
    }
    // concat, not push(...): a long line would be too many arguments for one call.
    return legs.reduce((all, leg) => all.concat(leg.points), points);
  }, [ownPosition, pickup, dropoff, legs]);

  const frame = () => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    // With an offer or job: everything on it. With nothing: the rider, then the
    // restaurants, then Volos (AC-5).
    const hasJob = pickup !== undefined || dropoff !== undefined;
    if (hasJob && fitPoints.length > 1) {
      map.fitToCoordinates(fitPoints, {
        edgePadding: {
          top: EDGE * 2,
          right: EDGE,
          bottom: bottomInset + EDGE,
          left: EDGE,
        },
        animated: true,
      });
      return;
    }
    if (ownPosition) {
      map.animateToRegion({ ...ownPosition, ...ZOOMED_IN });
      return;
    }
    if (pickupPoints.length > 1) {
      map.fitToCoordinates(pickupPoints, {
        edgePadding: {
          top: EDGE * 2,
          right: EDGE,
          bottom: bottomInset + EDGE,
          left: EDGE,
        },
        animated: true,
      });
      return;
    }
    map.animateToRegion({ ...FALLBACK_CENTRE, ...ZOOMED_IN });
  };

  // Fit once per delivery and status, so a rider who zoomed keeps the zoom
  // through the minute refetches, and again only when something the fit needs
  // first becomes available for this key: the map itself (Android ignores a
  // fit before it is ready), the card's height, the route's lines, the rider's
  // own position, or (with no job) the restaurants (Fable's review). Each of
  // these flips once, so the fit runs a few times at most per delivery and status.
  const [mapReady, setMapReady] = useState(false);
  const hasOwnPosition = ownPosition !== null;
  const hasLegs = legs.length > 0;
  const insetKnown = bottomInset > 0;
  const hasPickupPoints = pickupPoints.length > 0;
  useEffect(() => {
    if (mapReady) {
      frame();
    }
    // `frame` reads the latest props; only these changes should move the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, mapReady, hasOwnPosition, hasLegs, insetKnown, hasPickupPoints]);

  return (
    <View style={StyleSheet.absoluteFill} testID="route-map">
      {/* Markers keep tracking their views (the default): with tracking off,
          Android can snapshot a custom pin before it is drawn and show nothing. */}
      <MapView
        ref={mapRef}
        onMapReady={() => setMapReady(true)}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...(ownPosition ?? FALLBACK_CENTRE), ...ZOOMED_IN }}
        // The rider is drawn below from the phone's own fix; the map's own
        // location dot would start a second location reader (row 67).
        showsUserLocation={false}
        toolbarEnabled={false}>
        {legs.map(leg => (
          <Polyline
            key={leg.kind}
            testID={`route-leg-${leg.kind}`}
            coordinates={leg.points}
            strokeWidth={5}
            lineCap="round"
            strokeColor={
              isRiderLeg(leg)
                ? color.route
                : withAlpha(color['muted-foreground'], 0.7)
            }
          />
        ))}
        {restaurantLayerOn &&
          pickupPoints.map(point => (
            <Marker
              key={point.id}
              testID={`restaurant-pin-${point.id}`}
              coordinate={point}>
              <View style={styles.restaurantPin}>
                <Icon icon={StorefrontIcon} size={14} tone="muted-foreground" />
              </View>
              <Callout>
                <Text style={styles.callout}>{point.name}</Text>
              </Callout>
            </Marker>
          ))}
        {pickup && (
          <Marker coordinate={pickup} testID="pickup-pin">
            <View style={styles.jobPin}>
              <Icon
                icon={StorefrontIcon}
                weight="fill"
                size={20}
                tone="primary-foreground"
              />
            </View>
          </Marker>
        )}
        {dropoff && (
          <Marker coordinate={dropoff} testID="dropoff-pin">
            <View style={styles.jobPin}>
              <Icon
                icon={HouseLineIcon}
                weight="fill"
                size={20}
                tone="primary-foreground"
              />
            </View>
          </Marker>
        )}
        {ownPosition && (
          <Marker
            coordinate={ownPosition}
            testID="rider-marker"
            anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.riderOuter}>
              <View style={styles.riderInner} />
            </View>
          </Marker>
        )}
      </MapView>
      {/* Just above the card, clear of the banners at the top of home. */}
      <View style={[styles.mapButtons, { bottom: bottomInset + space['4'] }]}>
        <TouchableOpacity
          testID="map-layers-button"
          accessibilityRole="switch"
          accessibilityState={{ checked: restaurantLayerOn }}
          accessibilityLabel={t('translations:map_restaurant_layer')}
          style={[styles.mapButton, restaurantLayerOn && styles.mapButtonOn]}
          onPress={onToggleRestaurantLayer}>
          <Icon
            icon={StackIcon}
            weight={restaurantLayerOn ? 'fill' : 'regular'}
            tone={restaurantLayerOn ? 'primary-foreground' : 'foreground'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          testID="map-recentre-button"
          accessibilityRole="button"
          accessibilityLabel={t('translations:map_recentre')}
          style={styles.mapButton}
          onPress={frame}>
          <Icon icon={CrosshairIcon} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mapButtons: {
    position: 'absolute',
    right: space['4'],
    gap: space['2'],
  },
  mapButton: {
    width: control.xl,
    height: control.xl,
    borderRadius: radius.full,
    backgroundColor: color.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  mapButtonOn: {
    backgroundColor: color.primary,
  },
  restaurantPin: {
    width: control.sm,
    height: control.sm,
    borderRadius: radius.full,
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobPin: {
    width: control.lg,
    height: control.lg,
    borderRadius: radius.full,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  riderOuter: {
    width: control.xs,
    height: control.xs,
    borderRadius: radius.full,
    backgroundColor: withAlpha(color.route, 0.25),
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderInner: {
    width: space['3'],
    height: space['3'],
    borderRadius: radius.full,
    backgroundColor: color.route,
    borderWidth: 2,
    borderColor: color.card,
  },
  callout: {
    ...typeScale['body-sm'],
    color: color.foreground,
    padding: space['2'],
  },
});

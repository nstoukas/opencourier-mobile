import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Polyline } from 'react-native-maps';
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
import { PickupPoint, RouteLeg, RoutePoint, RouteStop } from '@app/types/route';
import { FALLBACK_CENTRE, isRiderLeg } from '@app/utilities/routeLegs';
import { StillMarker } from '@app/components/RouteMap/StillMarker';

type Props = {
  // The legs to draw, already filtered by `visibleLegs` (spec 0018, AC-6).
  legs: RouteLeg[];
  // The pins of the offer or job in the card; none when the card has nothing.
  pickup?: RoutePoint;
  dropoff?: RoutePoint;
  // Spec 0048 (AC-10): a stack's stops, pinned with their numbers 1 to 4 in
  // place of the two pins above. Empty or left out for a single order.
  stops?: RouteStop[];
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

// One empty list for every single order, so the memo below keeps its value.
const NO_STOPS: RouteStop[] = [];

const ZOOMED_IN = { latitudeDelta: 0.02, longitudeDelta: 0.02 };
const EDGE = 48;

// Spec 0018: the full screen map behind home. It draws the rider (from the
// phone), the restaurant and customer pins, each route leg, and, when on, a
// pin per restaurant. It never asks a routing server: the legs come in as props.
export const RouteMap = ({
  legs,
  pickup,
  dropoff,
  stops = NO_STOPS,
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
    stops.forEach(stop => points.push(stop));
    // concat, not push(...): a long line would be too many arguments for one call.
    return legs.reduce((all, leg) => all.concat(leg.points), points);
  }, [ownPosition, pickup, dropoff, stops, legs]);

  const frame = () => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    // With an offer or job: everything on it. With nothing: the rider, then the
    // restaurants, then Volos (AC-5).
    const hasJob =
      pickup !== undefined || dropoff !== undefined || stops.length > 0;
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
      {/* Row 125: every pin is a StillMarker, which redraws its picture only for
          a moment after it appears or its `lookKey` changes. A pin left redrawing
          all the time ran the app out of memory on Android in about 25 minutes.
          The short redraw at the start still covers what the old comment here
          warned about: a picture taken before the pin was drawn shows nothing. */}
      <MapView
        ref={mapRef}
        onMapReady={() => setMapReady(true)}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...(ownPosition ?? FALLBACK_CENTRE), ...ZOOMED_IN }}
        // The rider is drawn below from the phone's own fix; the map's own
        // location dot would start a second location reader (row 67).
        showsUserLocation={false}
        toolbarEnabled={false}>
        {legs.map((leg, index) => (
          <Polyline
            // A stack has several legs of one kind; the place in the list keeps keys apart.
            key={`${leg.kind}-${leg.toStopNumber ?? index}`}
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
            <StillMarker
              key={point.id}
              // Every restaurant pin looks the same and never changes; the name is in the callout.
              lookKey="restaurant"
              testID={`restaurant-pin-${point.id}`}
              coordinate={point}>
              <View style={styles.restaurantPin}>
                <Icon icon={StorefrontIcon} size={14} tone="muted-foreground" />
              </View>
              <Callout>
                <Text style={styles.callout}>{point.name}</Text>
              </Callout>
            </StillMarker>
          ))}
        {stops.map(stop => (
          <StillMarker
            key={`${stop.number}`}
            // The pin shows its number and turns grey once done: either change redraws it.
            lookKey={`${stop.number}-${stop.done ? 'done' : 'todo'}`}
            coordinate={stop}
            testID={`stack-stop-pin-${stop.number}`}
            anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.stopPin, stop.done && styles.stopPinDone]}>
              <Text
                style={[
                  styles.stopPinText,
                  stop.done && styles.stopPinTextDone,
                ]}>
                {stop.number}
              </Text>
            </View>
          </StillMarker>
        ))}
        {pickup && stops.length === 0 && (
          <StillMarker lookKey="pickup" coordinate={pickup} testID="pickup-pin">
            <View style={styles.jobPin}>
              <Icon
                icon={StorefrontIcon}
                weight="fill"
                size={20}
                tone="primary-foreground"
              />
            </View>
          </StillMarker>
        )}
        {dropoff && stops.length === 0 && (
          <StillMarker
            lookKey="dropoff"
            coordinate={dropoff}
            testID="dropoff-pin">
            <View style={styles.jobPin}>
              <Icon
                icon={HouseLineIcon}
                weight="fill"
                size={20}
                tone="primary-foreground"
              />
            </View>
          </StillMarker>
        )}
        {ownPosition && (
          <StillMarker
            // The dot moves with each fix but never changes its look: no redraw needed.
            lookKey="rider"
            coordinate={ownPosition}
            testID="rider-marker"
            anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.riderOuter}>
              <View style={styles.riderInner} />
            </View>
          </StillMarker>
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
  // Spec 0048: a stack's numbered stop, the same size as a job pin.
  stopPin: {
    width: control.lg,
    height: control.lg,
    borderRadius: radius.full,
    backgroundColor: color.primary,
    borderWidth: 2,
    borderColor: color.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  stopPinDone: {
    backgroundColor: color.muted,
  },
  stopPinText: {
    ...typeScale.label,
    color: color['primary-foreground'],
  },
  stopPinTextDone: {
    color: color['muted-foreground'],
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

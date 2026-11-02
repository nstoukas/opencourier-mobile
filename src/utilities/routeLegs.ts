import { OrderStatus } from '@app/types/enums';
import { RouteLeg, RouteLegKind, RoutePoint } from '@app/types/route';

// Spec 0018's rules for drawing a route and the cards' distance lines, kept
// apart from the screens so each rule can be tested on its own.

// A rider leg that starts further than this from where the phone says the
// rider is started from an old stored point: it is hidden (AC-6).
export const STALE_RIDER_LEG_METRES = 200;

// The restaurant layer is on by default for this many days after a rider's
// account was made, unless the rider chose (AC-11).
export const NEW_RIDER_DAYS = 30;

// Where the map looks when it knows nothing else: central Volos (AC-5).
export const FALLBACK_CENTRE: RoutePoint = {
  latitude: 39.3622,
  longitude: 22.9425,
};

const EARTH_RADIUS_METRES = 6371000;

// Straight line metres between two points (the haversine formula). Only used
// to compare two points on the phone, never to price or pay anything.
export const metresBetween = (a: RoutePoint, b: RoutePoint): number => {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(h));
};

export const isRiderLeg = (leg: RouteLeg): boolean =>
  leg.kind === RouteLegKind.RiderToPickup ||
  leg.kind === RouteLegKind.RiderToDropoff;

// The legs worth drawing (AC-6). A rider leg is hidden when the phone has no
// position of its own (permission refused, no fix yet), or when it starts more
// than 200 m from that position: the server's stored point is then old.
export const visibleLegs = (
  legs: RouteLeg[],
  ownPosition: RoutePoint | null,
): RouteLeg[] =>
  legs.filter(leg => {
    if (!isRiderLeg(leg)) {
      return true;
    }
    const start = leg.points[0];
    return (
      ownPosition !== null &&
      start !== undefined &&
      metresBetween(start, ownPosition) <= STALE_RIDER_LEG_METRES
    );
  });

// Before the food is collected the rider rides to the restaurant first.
export const isBeforePickup = (status: string): boolean =>
  status === OrderStatus.accepted ||
  status === OrderStatus.dispatched ||
  status === OrderStatus.courier_arrived_at_pickup_location;

export type LegFigures = { km: string; minutes: number };

const figuresOf = (leg: RouteLeg | undefined): LegFigures | undefined =>
  leg === undefined
    ? undefined
    : {
        // One decimal, as the rider reads it: 1234 m is "1.2".
        km: (leg.distanceMetres / 1000).toFixed(1),
        // Whole minutes, never "0 min" for a short hop.
        minutes: Math.max(1, Math.round(leg.durationSeconds / 60)),
      };

// The cards' two distance lines (AC-7), from the legs that are drawn. Each is
// left out when its leg is not there.
export const legLines = (
  legs: RouteLeg[],
): { toRestaurant?: LegFigures; toCustomer?: LegFigures } => {
  const byKind = (kind: RouteLegKind) => legs.find(leg => leg.kind === kind);
  const riderToDropoff = byKind(RouteLegKind.RiderToDropoff);
  return {
    toRestaurant: figuresOf(byKind(RouteLegKind.RiderToPickup)),
    toCustomer: figuresOf(
      riderToDropoff ?? byKind(RouteLegKind.PickupToDropoff),
    ),
  };
};

// Whether the restaurant layer starts on (AC-11): the rider's saved choice
// wins; with none, it is on during the account's first 30 days.
export const restaurantLayerOn = (
  saved: 'on' | 'off' | null,
  accountCreatedAt: string | undefined,
  now: number = Date.now(),
): boolean => {
  if (saved !== null) {
    return saved === 'on';
  }
  const created = accountCreatedAt ? Date.parse(accountCreatedAt) : NaN;
  if (Number.isNaN(created)) {
    return false;
  }
  return now - created < NEW_RIDER_DAYS * 24 * 60 * 60 * 1000;
};

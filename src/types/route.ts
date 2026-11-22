// Spec 0018: what the backend's route answers, and the restaurant layer's points.

export type RoutePoint = {
  latitude: number;
  longitude: number;
};

// The legs of a route, in riding order (AC-1).
export enum RouteLegKind {
  RiderToPickup = 'RIDER_TO_PICKUP',
  PickupToDropoff = 'PICKUP_TO_DROPOFF',
  RiderToDropoff = 'RIDER_TO_DROPOFF',
  // Spec 0048: from one stop of a stack to the next.
  BetweenStops = 'BETWEEN_STOPS',
}

export type RouteLeg = {
  kind: RouteLegKind;
  distanceMetres: number;
  durationSeconds: number;
  points: RoutePoint[];
  // Spec 0048: for a stack, the number of the stop this leg ends at.
  toStopNumber?: number;
};

// Spec 0048 (AC-10): one numbered stop of a stack's route, as the backend
// answers it; the map pins it with its number.
export type RouteStop = {
  number: number;
  deliveryId: string;
  stop: 'PICKUP' | 'DROPOFF';
  latitude: number;
  longitude: number;
  // Already behind the rider: picked up, or handed over.
  done: boolean;
};

// Spec 0048: a stack's route, the legs and the numbered stops.
export type StackRoute = {
  legs: RouteLeg[];
  stops: RouteStop[];
};

// One restaurant on the restaurant layer: its name and where riders collect.
export type PickupPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

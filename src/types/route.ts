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
}

export type RouteLeg = {
  kind: RouteLegKind;
  distanceMetres: number;
  durationSeconds: number;
  points: RoutePoint[];
};

// One restaurant on the restaurant layer: its name and where riders collect.
export type PickupPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

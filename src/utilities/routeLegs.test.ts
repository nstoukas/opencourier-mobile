import { OrderStatus } from '@app/types/enums';
import { RouteLeg, RouteLegKind, RoutePoint } from '@app/types/route';
import {
  FALLBACK_CENTRE,
  isBeforePickup,
  legLines,
  metresBetween,
  NEW_RIDER_DAYS,
  restaurantLayerOn,
  STALE_RIDER_LEG_METRES,
  visibleLegs,
} from './routeLegs';

describe('routeLegs (spec 0018, AC-6, AC-7, AC-11)', () => {
  const origin: RoutePoint = { latitude: 39.3622, longitude: 22.9425 };

  // Calculate a point north of origin at approximately given metres
  const pointAtMetresNorth = (from: RoutePoint, metres: number): RoutePoint => {
    const latDelta = (metres / 6371000) * (180 / Math.PI);
    return {
      latitude: from.latitude + latDelta,
      longitude: from.longitude,
    };
  };

  describe('metresBetween and constants', () => {
    it('defines STALE_RIDER_LEG_METRES as 200, NEW_RIDER_DAYS as 30, and FALLBACK_CENTRE as Volos', () => {
      expect(STALE_RIDER_LEG_METRES).toBe(200);
      expect(NEW_RIDER_DAYS).toBe(30);
      expect(FALLBACK_CENTRE).toEqual({
        latitude: 39.3622,
        longitude: 22.9425,
      });
    });

    it('calculates metresBetween using the haversine formula', () => {
      expect(metresBetween(origin, origin)).toBe(0);
      const point100m = pointAtMetresNorth(origin, 100);
      expect(Math.round(metresBetween(origin, point100m))).toBe(100);
    });
  });

  describe('visibleLegs (AC-6)', () => {
    const pickupToDropoffLeg: RouteLeg = {
      kind: RouteLegKind.PickupToDropoff,
      distanceMetres: 1500,
      durationSeconds: 300,
      points: [
        { latitude: 39.365, longitude: 22.945 },
        { latitude: 39.37, longitude: 22.95 },
      ],
    };

    it('keeps PICKUP_TO_DROPOFF always, even when ownPosition is null', () => {
      expect(visibleLegs([pickupToDropoffLeg], null)).toEqual([pickupToDropoffLeg]);
    });

    it('drops a rider leg when own position is null', () => {
      const riderLeg: RouteLeg = {
        kind: RouteLegKind.RiderToPickup,
        distanceMetres: 500,
        durationSeconds: 120,
        points: [origin, { latitude: 39.365, longitude: 22.945 }],
      };
      expect(visibleLegs([riderLeg, pickupToDropoffLeg], null)).toEqual([pickupToDropoffLeg]);
    });

    it('drops a rider leg when the leg has no points', () => {
      const emptyRiderLeg: RouteLeg = {
        kind: RouteLegKind.RiderToPickup,
        distanceMetres: 500,
        durationSeconds: 120,
        points: [],
      };
      expect(visibleLegs([emptyRiderLeg, pickupToDropoffLeg], origin)).toEqual([pickupToDropoffLeg]);
    });

    it('keeps a rider leg when within 200 m (testing 199 m) and drops at 201 m', () => {
      const point199m = pointAtMetresNorth(origin, 199);
      const point201m = pointAtMetresNorth(origin, 201);

      // Verify exact distances
      expect(metresBetween(origin, point199m)).toBeLessThan(200);
      expect(metresBetween(origin, point201m)).toBeGreaterThan(200);

      const legAt199: RouteLeg = {
        kind: RouteLegKind.RiderToPickup,
        distanceMetres: 1000,
        durationSeconds: 200,
        points: [point199m, { latitude: 39.37, longitude: 22.95 }],
      };

      const legAt201: RouteLeg = {
        kind: RouteLegKind.RiderToPickup,
        distanceMetres: 1000,
        durationSeconds: 200,
        points: [point201m, { latitude: 39.37, longitude: 22.95 }],
      };

      expect(visibleLegs([legAt199], origin)).toEqual([legAt199]);
      expect(visibleLegs([legAt201], origin)).toEqual([]);
    });

    it('applies the 200 m rule to RIDER_TO_DROPOFF as well', () => {
      const point150m = pointAtMetresNorth(origin, 150);
      const point250m = pointAtMetresNorth(origin, 250);

      const closeRiderToDropoff: RouteLeg = {
        kind: RouteLegKind.RiderToDropoff,
        distanceMetres: 800,
        durationSeconds: 180,
        points: [point150m, { latitude: 39.38, longitude: 22.96 }],
      };

      const staleRiderToDropoff: RouteLeg = {
        kind: RouteLegKind.RiderToDropoff,
        distanceMetres: 800,
        durationSeconds: 180,
        points: [point250m, { latitude: 39.38, longitude: 22.96 }],
      };

      expect(visibleLegs([closeRiderToDropoff], origin)).toEqual([closeRiderToDropoff]);
      expect(visibleLegs([staleRiderToDropoff], origin)).toEqual([]);
    });
  });

  describe('legLines (AC-7)', () => {
    it('maps RIDER_TO_PICKUP to toRestaurant and PICKUP_TO_DROPOFF to toCustomer with km (one decimal) and rounded minutes (min 1)', () => {
      const legs: RouteLeg[] = [
        {
          kind: RouteLegKind.RiderToPickup,
          distanceMetres: 1234,
          durationSeconds: 240, // 4 min
          points: [origin],
        },
        {
          kind: RouteLegKind.PickupToDropoff,
          distanceMetres: 2900,
          durationSeconds: 310, // 5.16 min -> 5 min
          points: [origin],
        },
      ];

      const lines = legLines(legs);
      expect(lines.toRestaurant).toEqual({ km: '1.2', minutes: 4 });
      expect(lines.toCustomer).toEqual({ km: '2.9', minutes: 5 });
    });

    it('prefers RIDER_TO_DROPOFF over PICKUP_TO_DROPOFF for toCustomer', () => {
      const legs: RouteLeg[] = [
        {
          kind: RouteLegKind.PickupToDropoff,
          distanceMetres: 3000,
          durationSeconds: 600,
          points: [origin],
        },
        {
          kind: RouteLegKind.RiderToDropoff,
          distanceMetres: 1500,
          durationSeconds: 180,
          points: [origin],
        },
      ];

      const lines = legLines(legs);
      expect(lines.toCustomer).toEqual({ km: '1.5', minutes: 3 });
      expect(lines.toRestaurant).toBeUndefined();
    });

    it('ensures minutes is at least 1 even for short durations (0 or 20 seconds)', () => {
      const legs: RouteLeg[] = [
        {
          kind: RouteLegKind.RiderToPickup,
          distanceMetres: 50,
          durationSeconds: 20,
          points: [origin],
        },
      ];

      const lines = legLines(legs);
      expect(lines.toRestaurant).toEqual({ km: '0.1', minutes: 1 });
    });

    it('returns undefined when legs are missing', () => {
      const lines = legLines([]);
      expect(lines.toRestaurant).toBeUndefined();
      expect(lines.toCustomer).toBeUndefined();
    });
  });

  describe('restaurantLayerOn (AC-11)', () => {
    const fixedNow = new Date('2026-11-02T12:00:00Z').getTime();

    it('respects saved on/off over rider account age', () => {
      // Saved 'on' wins even if account is 100 days old
      const oldAccount = new Date(fixedNow - 100 * 24 * 60 * 60 * 1000).toISOString();
      expect(restaurantLayerOn('on', oldAccount, fixedNow)).toBe(true);

      // Saved 'off' wins even if account is 2 days old
      const freshAccount = new Date(fixedNow - 2 * 24 * 60 * 60 * 1000).toISOString();
      expect(restaurantLayerOn('off', freshAccount, fixedNow)).toBe(false);
    });

    it('defaults to on at 29 days and off at 31 days when no choice is saved', () => {
      const day29Account = new Date(fixedNow - 29 * 24 * 60 * 60 * 1000).toISOString();
      const day31Account = new Date(fixedNow - 31 * 24 * 60 * 60 * 1000).toISOString();

      expect(restaurantLayerOn(null, day29Account, fixedNow)).toBe(true);
      expect(restaurantLayerOn(null, day31Account, fixedNow)).toBe(false);
    });

    it('defaults to off when account createdAt is missing or invalid', () => {
      expect(restaurantLayerOn(null, undefined, fixedNow)).toBe(false);
      expect(restaurantLayerOn(null, 'not-a-valid-date', fixedNow)).toBe(false);
    });
  });

  describe('isBeforePickup', () => {
    it('returns true for ACCEPTED, DISPATCHED, and COURIER_ARRIVED_AT_PICKUP_LOCATION only', () => {
      expect(isBeforePickup(OrderStatus.accepted)).toBe(true);
      expect(isBeforePickup(OrderStatus.dispatched)).toBe(true);
      expect(isBeforePickup(OrderStatus.courier_arrived_at_pickup_location)).toBe(true);

      expect(isBeforePickup(OrderStatus.picked_up)).toBe(false);
      expect(isBeforePickup(OrderStatus.on_the_way)).toBe(false);
      expect(isBeforePickup(OrderStatus.courier_arrived_at_dropoff_location)).toBe(false);
      expect(isBeforePickup(OrderStatus.dropped_off)).toBe(false);
      expect(isBeforePickup(OrderStatus.canceled)).toBe(false);
    });
  });
});

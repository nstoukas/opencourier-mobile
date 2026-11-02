import { kmText, offerTripLines, OfferTrip } from './offerTrip';
import i18n from '@app/localization/i18n';

describe('offerTrip (spec 0019, AC-3, Pin 1)', () => {
  describe('kmText', () => {
    it('rounds metres to one decimal place', () => {
      // 1234m -> 1.2 km
      expect(kmText(1234)).toBe('1.2');
      // 1250m -> 1.3 km (rounds up at half)
      expect(kmText(1250)).toBe('1.3');
      // 0m -> 0.0 km
      expect(kmText(0)).toBe('0.0');
      // Edge cases
      expect(kmText(49)).toBe('0.0');
      expect(kmText(50)).toBe('0.1');
      expect(kmText(999)).toBe('1.0');
      expect(kmText(2850)).toBe('2.9');
      expect(kmText(10000)).toBe('10.0');
    });
  });

  describe('offerTripLines', () => {
    const t = i18n.t.bind(i18n);

    it('returns both distance parts joined by " · " and minutes when both legs are known', () => {
      const trip: OfferTrip = {
        toPickupMetres: 1234,
        toDropoffMetres: 2850,
        minutes: 9,
      };

      const result = offerTripLines(trip, t);
      expect(result.distances).toBe(
        '1.2 km to the restaurant · 2.9 km to the customer',
      );
      expect(result.minutes).toBe('About 9 min');
    });

    it('returns only restaurant distance without separator when customer leg is unknown', () => {
      const trip: OfferTrip = {
        toPickupMetres: 1234,
        toDropoffMetres: null,
        minutes: null,
      };

      const result = offerTripLines(trip, t);
      expect(result.distances).toBe('1.2 km to the restaurant');
      expect(result.distances).not.toContain('·');
      expect(result.minutes).toBe('');
    });

    it('returns only customer distance without separator when restaurant leg is unknown', () => {
      const trip: OfferTrip = {
        toPickupMetres: null,
        toDropoffMetres: 2850,
        minutes: null,
      };

      const result = offerTripLines(trip, t);
      expect(result.distances).toBe('2.9 km to the customer');
      expect(result.distances).not.toContain('·');
      expect(result.minutes).toBe('');
    });

    it('returns empty strings when neither leg is known', () => {
      const trip: OfferTrip = {
        toPickupMetres: null,
        toDropoffMetres: null,
        minutes: null,
      };

      const result = offerTripLines(trip, t);
      expect(result.distances).toBe('');
      expect(result.minutes).toBe('');
    });

    it('returns empty strings when trip is undefined', () => {
      const result = offerTripLines(undefined, t);
      expect(result.distances).toBe('');
      expect(result.minutes).toBe('');
    });

    it('returns minutes when minutes are provided and empty string when null', () => {
      const tripWithMinutes: OfferTrip = {
        toPickupMetres: null,
        toDropoffMetres: null,
        minutes: 15,
      };
      expect(offerTripLines(tripWithMinutes, t).minutes).toBe('About 15 min');

      const tripWithoutMinutes: OfferTrip = {
        toPickupMetres: 1200,
        toDropoffMetres: 2900,
        minutes: null,
      };
      expect(offerTripLines(tripWithoutMinutes, t).minutes).toBe('');
    });
  });
});

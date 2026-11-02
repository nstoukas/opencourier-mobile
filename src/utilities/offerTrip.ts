// Spec 0019: the ride an offer means, as the backend sends it (display only:
// pay always comes from the stored quote).
export type OfferTrip = {
  toPickupMetres: number | null;
  toDropoffMetres: number | null;
  minutes: number | null;
};

// Metres as the rider reads them: 1234 m is "1.2" (one decimal).
export const kmText = (metres: number): string =>
  (Math.round(metres / 100) / 10).toFixed(1);

type Translate = (key: string, options?: Record<string, unknown>) => string;

// The card's two lines (AC-3): "1.2 km to the restaurant · 2.9 km to the
// customer" and "About 9 min". A part whose figure is unknown is left out; a
// line with nothing in it is ''.
export const offerTripLines = (
  trip: OfferTrip | undefined,
  t: Translate,
): { distances: string; minutes: string } => {
  const parts: string[] = [];
  if (trip?.toPickupMetres != null) {
    parts.push(
      t('translations:offer_km_to_restaurant', {
        km: kmText(trip.toPickupMetres),
      }),
    );
  }
  if (trip?.toDropoffMetres != null) {
    parts.push(
      t('translations:offer_km_to_customer', {
        km: kmText(trip.toDropoffMetres),
      }),
    );
  }
  return {
    distances: parts.join(' · '),
    minutes:
      trip?.minutes != null
        ? t('translations:offer_about_minutes', { minutes: trip.minutes })
        : '',
  };
};

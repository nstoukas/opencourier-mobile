// Spec 0021 (AC-12): the deliveries whose hand back request is on its way to
// the server right now. A held arrival is never released while its delivery's
// hand back is in flight: the arrival would win the race and the hand back
// would be refused "you are at the restaurant".
const inFlight = new Set<string>();

export const startHandBack = (deliveryId: string) => {
  inFlight.add(deliveryId);
};

export const endHandBack = (deliveryId: string) => {
  inFlight.delete(deliveryId);
};

export const isHandBackInFlight = (deliveryId: string): boolean =>
  inFlight.has(deliveryId);

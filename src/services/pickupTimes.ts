// Spec 0021 (AC-6, review fix): when the rider swiped "Picked up" on each job, on the phone's clock,
// so the card after pickup can say "picked up 12:41". The job list carries no step times (its
// `pickupReadyAt` is the restaurant's planned ready time, set at the quote: never shown as the
// pickup). Memory only: after an app restart the card shows the restaurant's name without a time,
// rather than any other timestamp.
const pickedUpAt = new Map<string, number>();

export const setPickedUpAt = (deliveryId: string, at: number) => {
  pickedUpAt.set(deliveryId, at);
};

export const getPickedUpAt = (deliveryId: string): number | undefined =>
  pickedUpAt.get(deliveryId);

// At logout: the next rider on this phone starts with nothing.
export const clearPickedUpTimes = () => pickedUpAt.clear();

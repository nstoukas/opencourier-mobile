// Rows 154 and 155 review: an OFFER_ENDED message names the offer that ended by its delivery and its
// `offeredAt`. A message that arrives late (after the same delivery was offered to this rider again) must not
// drop the newer offer. With no `offeredAt` on either side (an older server, or an offer stored without it),
// the delivery id alone decides, as before.
export const isTheEndedOffer = (
  shownOfferedAt: string | null | undefined,
  endedOfferedAt: string | null,
): boolean =>
  endedOfferedAt === null ||
  !shownOfferedAt ||
  shownOfferedAt === endedOfferedAt;

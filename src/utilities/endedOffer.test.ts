import { isTheEndedOffer } from './endedOffer';

describe('isTheEndedOffer (Rows 154 and 155 review)', () => {
  it('returns true when endedOfferedAt is null (older server)', () => {
    // If the server did not supply offeredAt on the ended message, any offer matches
    expect(isTheEndedOffer('2026-11-24T18:00:00.000Z', null)).toBe(true);
    expect(isTheEndedOffer(null, null)).toBe(true);
    expect(isTheEndedOffer(undefined, null)).toBe(true);
  });

  it('returns true when shownOfferedAt is missing or null', () => {
    // If the shown or cached offer has no offeredAt stored, it matches the ended message
    expect(isTheEndedOffer(null, '2026-11-24T18:00:00.000Z')).toBe(true);
    expect(isTheEndedOffer(undefined, '2026-11-24T18:00:00.000Z')).toBe(true);
    expect(isTheEndedOffer('', '2026-11-24T18:00:00.000Z')).toBe(true);
  });

  it('returns true when shownOfferedAt matches endedOfferedAt', () => {
    const timestamp = '2026-11-24T18:00:00.000Z';
    expect(isTheEndedOffer(timestamp, timestamp)).toBe(true);
  });

  it('returns false when shownOfferedAt differs from endedOfferedAt', () => {
    const older = '2026-11-24T18:00:00.000Z';
    const newer = '2026-11-24T18:05:00.000Z';
    // A newer offer of the same delivery must not be dropped by an older ended message
    expect(isTheEndedOffer(newer, older)).toBe(false);
    expect(isTheEndedOffer(older, newer)).toBe(false);
  });
});

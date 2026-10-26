import { offerTimesOnPhone } from './offerClock';

describe('offerTimesOnPhone (spec 0002, AC-9)', () => {
  // Base server time: 2026-10-26T12:00:00.000Z (1793016000000 ms)
  const serverNowIso = '2026-10-26T12:00:00.000Z';
  const serverNowMs = Date.parse(serverNowIso);

  const offeredAtIso = '2026-10-26T11:59:30.000Z'; // 30s ago on server
  const offeredAtMs = Date.parse(offeredAtIso);

  const expiresAtIso = '2026-10-26T12:00:30.000Z'; // 30s in the future on server (60s total)
  const expiresAtMs = Date.parse(expiresAtIso);

  it('keeps exact time remaining when phone clock and server clock are in sync', () => {
    const phoneNow = serverNowMs;
    const result = offerTimesOnPhone(
      { offeredAt: offeredAtIso, offerExpiresAt: expiresAtIso },
      serverNowIso,
      phoneNow,
    );

    expect(result.offeredAt).toBe(offeredAtMs);
    expect(result.expiresAt).toBe(expiresAtMs);
    // 30 seconds remaining on phone
    expect(result.expiresAt! - phoneNow).toBe(30000);
  });

  it('corrects for phone clock being 2 minutes fast so deadline duration does not move', () => {
    // Phone is 2 minutes (120,000 ms) ahead of server clock
    const phoneNow = serverNowMs + 120000;
    const result = offerTimesOnPhone(
      { offeredAt: offeredAtIso, offerExpiresAt: expiresAtIso },
      serverNowIso,
      phoneNow,
    );

    // Phone expiresAt is shifted by +120s to match phone clock
    expect(result.expiresAt).toBe(expiresAtMs + 120000);
    expect(result.offeredAt).toBe(offeredAtMs + 120000);

    // Remaining time calculated on the phone is still exactly 30s
    expect(result.expiresAt! - phoneNow).toBe(30000);
  });

  it('corrects for phone clock being 2 minutes slow so deadline duration does not move', () => {
    // Phone is 2 minutes (120,000 ms) behind server clock
    const phoneNow = serverNowMs - 120000;
    const result = offerTimesOnPhone(
      { offeredAt: offeredAtIso, offerExpiresAt: expiresAtIso },
      serverNowIso,
      phoneNow,
    );

    // Phone expiresAt is shifted by -120s to match phone clock
    expect(result.expiresAt).toBe(expiresAtMs - 120000);
    expect(result.offeredAt).toBe(offeredAtMs - 120000);

    // Remaining time calculated on the phone is still exactly 30s
    expect(result.expiresAt! - phoneNow).toBe(30000);
  });

  it('returns expiresAt null when offerExpiresAt is null (expiry off, AC-4)', () => {
    const result = offerTimesOnPhone(
      { offeredAt: offeredAtIso, offerExpiresAt: null },
      serverNowIso,
      serverNowMs,
    );

    expect(result.expiresAt).toBeNull();
    expect(result.offeredAt).toBe(offeredAtMs);
  });

  it('returns offeredAt null when offeredAt is null or undefined (older offer)', () => {
    const result = offerTimesOnPhone(
      { offeredAt: null, offerExpiresAt: expiresAtIso },
      serverNowIso,
      serverNowMs,
    );

    expect(result.offeredAt).toBeNull();
    expect(result.expiresAt).toBe(expiresAtMs);
  });

  it('falls back to raw server timestamps when serverNow is null or invalid (older server)', () => {
    const phoneNow = serverNowMs + 50000;
    // Without serverNow, phoneAhead is 0
    const resultNull = offerTimesOnPhone(
      { offeredAt: offeredAtIso, offerExpiresAt: expiresAtIso },
      null,
      phoneNow,
    );
    expect(resultNull.expiresAt).toBe(expiresAtMs);
    expect(resultNull.offeredAt).toBe(offeredAtMs);

    const resultInvalid = offerTimesOnPhone(
      { offeredAt: offeredAtIso, offerExpiresAt: expiresAtIso },
      'not-a-valid-date',
      phoneNow,
    );
    expect(resultInvalid.expiresAt).toBe(expiresAtMs);
    expect(resultInvalid.offeredAt).toBe(offeredAtMs);
  });

  it('returns null for unparseable offeredAt or offerExpiresAt strings', () => {
    const result = offerTimesOnPhone(
      { offeredAt: 'invalid-date', offerExpiresAt: 'invalid-date' },
      serverNowIso,
      serverNowMs,
    );

    expect(result.offeredAt).toBeNull();
    expect(result.expiresAt).toBeNull();
  });
});

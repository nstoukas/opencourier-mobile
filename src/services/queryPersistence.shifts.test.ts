import { Query } from '@tanstack/react-query';
import { QueryKeys } from '@app/utilities/queryKeys';
import { shouldKeepQuery } from './queryPersistence';

// Spec 0027: the schedule is saved to disk, so the banner and the reminders survive a restart with no signal.
describe('queryPersistence keeps the shift schedule (spec 0027)', () => {
  const makeQuery = (
    key: string,
    data: unknown,
    status: 'success' | 'error' | 'pending' = 'success',
  ): Query =>
    ({ queryKey: [key], state: { status, data } } as unknown as Query);

  it("QueryKeys.shifts is 'shifts'", () => {
    expect(QueryKeys.shifts).toBe('shifts');
  });

  it('keeps a shifts query holding data, whatever its status', () => {
    const data = {
      serverNow: '2026-11-06T10:00:00.000Z',
      occurrences: [],
      myBookings: [],
      clockOffsetMs: 0,
    };
    expect(shouldKeepQuery(makeQuery(QueryKeys.shifts, data, 'success'))).toBe(
      true,
    );
    // A refetch that failed with no signal still holds the last schedule.
    expect(shouldKeepQuery(makeQuery(QueryKeys.shifts, data, 'error'))).toBe(
      true,
    );
  });

  it('drops a shifts query with no data', () => {
    expect(
      shouldKeepQuery(makeQuery(QueryKeys.shifts, undefined, 'error')),
    ).toBe(false);
  });
});

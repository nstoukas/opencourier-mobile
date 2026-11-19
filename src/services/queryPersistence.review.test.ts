import { Query } from '@tanstack/react-query';
import { QueryKeys } from '@app/utilities/queryKeys';
import { shouldKeepQuery } from './queryPersistence';

// Spec 0038 (AC-11): the explanation page, review requests and what changed are never saved to disk.
// The page must always show the settings in effect when it opens, and review requests/changes must not be stale.
describe('queryPersistence does not persist review directive queries (spec 0038, AC-11)', () => {
  const makeQuery = (
    key: string,
    data: unknown,
    status: 'success' | 'error' | 'pending' = 'success',
  ): Query =>
    ({ queryKey: [key], state: { status, data } } as unknown as Query);

  it('drops howItWorks query from persistence even when holding data', () => {
    const howItWorksData = {
      offers: ['Nearest rider'],
      pay: ['Base fee €2.00'],
      personDecides: ['A person decides'],
      appRecords: ['Location while online'],
      reviewAnswerDays: 14,
    };
    expect(
      shouldKeepQuery(
        makeQuery(QueryKeys.howItWorks, howItWorksData, 'success'),
      ),
    ).toBe(false);
  });

  it('drops reviewRequests query from persistence even when holding data', () => {
    const reviewRequestsData = {
      pages: [{ data: [{ id: 'rev-1', status: 'OPEN' }] }],
    };
    expect(
      shouldKeepQuery(
        makeQuery(QueryKeys.reviewRequests, reviewRequestsData, 'success'),
      ),
    ).toBe(false);
  });

  it('drops settingChanges query from persistence even when holding data', () => {
    const settingChangesData = {
      pages: [{ data: [{ at: '2026-11-19T00:00:00Z', label: 'Rate' }] }],
    };
    expect(
      shouldKeepQuery(
        makeQuery(QueryKeys.settingChanges, settingChangesData, 'success'),
      ),
    ).toBe(false);
  });
});

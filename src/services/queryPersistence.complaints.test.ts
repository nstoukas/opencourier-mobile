import { Query } from '@tanstack/react-query';
import { QueryKeys } from '@app/utilities/queryKeys';
import { shouldKeepQuery } from './queryPersistence';

// Spec 0052: complaints are never saved to disk (queryPersistence.ts keeps only the keys it lists).
// A reply box must show only while the server still waits for the reply.
describe('queryPersistence does not persist complaints queries (spec 0052, AC-4, AC-5)', () => {
  const makeQuery = (
    key: string,
    data: unknown,
    status: 'success' | 'error' | 'pending' = 'success',
  ): Query =>
    ({ queryKey: [key], state: { status, data } } as unknown as Query);

  it('drops complaints query from persistence even when holding data', () => {
    const complaintsData = {
      pages: [{ data: [{ id: 'comp-1', status: 'AWAITING_REPLY' }] }],
    };
    expect(
      shouldKeepQuery(
        makeQuery(QueryKeys.complaints, complaintsData, 'success'),
      ),
    ).toBe(false);
  });
});

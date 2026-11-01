import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { Query } from '@tanstack/react-query';
import { QueryKeys } from '@app/utilities/queryKeys';

// How long the app keeps what it last loaded, so it stays readable with no
// signal, even after the app was closed (spec 0009, AC-1). A constant, not a
// co-op setting: it decides no pay and no assignment.
export const QUERY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Only these are kept on the phone: the rider, the deliveries in progress, the
// earnings and the dispatch number (row 72: a rider with no data signal can
// still make a call). Offers never are: they end, and an old one must not show.
const KEPT_QUERIES = new Set<string>([
  QueryKeys.user,
  QueryKeys.inProgressOrders,
  QueryKeys.earningsSummary,
  QueryKeys.earningsDay,
  QueryKeys.earningsDelivery,
  QueryKeys.jobContact,
  // A cancelled job's card must survive a restart with no signal (spec 0015, AC-12).
  QueryKeys.cancelledJobs,
]);

// Kept whenever it holds data. Not "status is success": a refetch that fails
// with no signal sets the status to error but keeps the data, and that data is
// exactly what must survive the next restart (row 20 review).
export const shouldKeepQuery = (query: Query): boolean =>
  KEPT_QUERIES.has(String(query.queryKey[0])) && query.state.data !== undefined;

// Saves the query cache in AsyncStorage (at most once a second) and reads it
// back when the app starts.
export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'queryCache',
});

// What PersistQueryClientProvider needs (App.tsx).
export const persistOptions = {
  persister: queryPersister,
  maxAge: QUERY_CACHE_MAX_AGE_MS,
  dehydrateOptions: { shouldDehydrateQuery: shouldKeepQuery },
};

// Removes the saved copy: at logout and when a session ends, so the next
// rider on this phone never sees another rider's deliveries (AC-11).
export const clearSavedQueries = async (): Promise<void> => {
  try {
    await queryPersister.removeClient();
  } catch (error) {
    console.log('Could not remove the saved query cache', error);
  }
};

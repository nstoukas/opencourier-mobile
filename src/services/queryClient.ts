import { QUERY_CACHE_MAX_AGE_MS } from './queryPersistence';
import { QueryClient } from '@tanstack/react-query';

// The app's one React Query cache. It lives in its own file (it was made in
// App.tsx) so code that runs outside React, the offer alert's Accept and
// Decline buttons (row 58), can ask the open app to fetch its lists again.
// `gcTime` is how long a query no screen uses stays in the cache. The saved
// copy (queryPersistence.ts) drops anything older than it, so it matches the
// 24 hours the app keeps data for reading offline (spec 0009, AC-1).
export const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: QUERY_CACHE_MAX_AGE_MS } },
});

import { QueryClient } from '@tanstack/react-query';

// The app's one React Query cache. It lives in its own file (it was made in
// App.tsx) so code that runs outside React, the offer alert's Accept and
// Decline buttons (row 58), can ask the open app to fetch its lists again.
export const queryClient = new QueryClient();

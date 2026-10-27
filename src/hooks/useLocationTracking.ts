import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Geolocation from 'react-native-geolocation-service';
import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import { filterInProgressOrdersForDisplay } from '@app/utilities/inProgressListFilter';
import { track } from '@app/utilities/geo';
import {
  TrackingMode,
  WATCH_OPTIONS,
  trackingModeFor,
} from '@app/utilities/locationTracking';
import { User } from '@app/types/types';

// The app's one location watch (row 67). It runs only while the rider is
// Online or carrying a job, and stops the moment neither is true. Each fix is
// sent to the server and written into the cached user, so the screens show it;
// no data is fetched again because of it.
export const useLocationTracking = (
  user: User | undefined,
  hasPermission: boolean,
): TrackingMode => {
  const queryClient = useQueryClient();
  // Jobs the rider still carries: the same query (and cache) as the live
  // connection and Home's In Progress tab, so it adds no extra request.
  const { data: inProgressOrders } = useQuery({
    queryFn: services.orderService.getInProgressOrders,
    queryKey: [QueryKeys.inProgressOrders],
    enabled: !!user,
    select: data => filterInProgressOrdersForDisplay(data),
  });

  const mode = trackingModeFor(
    user?.status,
    inProgressOrders?.length ?? 0,
    hasPermission,
  );

  useEffect(() => {
    if (mode === TrackingMode.Off) {
      return;
    }
    // False once this watch is stopped, so a first fix that arrives late
    // (the one shot read waits up to 15 s) is dropped, never sent.
    let active = true;
    const watchId = track(point => {
      if (!active) {
        return;
      }
      const latitude = point.coordinates[1];
      const longitude = point.coordinates[0];
      services.userService
        .setUserLocation({ latitude, longitude })
        // A lost fix is fine: the next one follows shortly.
        .catch(error => console.log('Could not send location', error));
      // The distance and the map read the rider's position from the cached
      // user. `setQueryData` writes the new position into that cache directly:
      // the screens update and nothing is fetched again.
      queryClient.setQueryData<User>([QueryKeys.user], cached =>
        cached
          ? { ...cached, currentLocation: { latitude, longitude } }
          : cached,
      );
    }, WATCH_OPTIONS[mode]);
    // React runs this when the mode changes or the app logs out, so the old
    // watch always stops before a new one starts: one watch at a time.
    return () => {
      active = false;
      Geolocation.clearWatch(watchId);
    };
  }, [mode, queryClient]);

  return mode;
};

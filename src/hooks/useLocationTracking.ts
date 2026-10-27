import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
// sent to the server and nothing else: no data is fetched again because of it.
export const useLocationTracking = (
  user: User | undefined,
  hasPermission: boolean,
): TrackingMode => {
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
    const watchId = track(
      point =>
        services.userService
          .setUserLocation({
            latitude: point.coordinates[1],
            longitude: point.coordinates[0],
          })
          // A lost fix is fine: the next one follows shortly.
          .catch(error => console.log('Could not send location', error)),
      WATCH_OPTIONS[mode],
    );
    // React runs this when the mode changes or the app logs out, so the old
    // watch always stops before a new one starts: one watch at a time.
    return () => Geolocation.clearWatch(watchId);
  }, [mode]);

  return mode;
};

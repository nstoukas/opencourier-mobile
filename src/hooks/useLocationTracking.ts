import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
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
import {
  showOnlineService,
  stopOnlineService,
  TrackingOnMode,
} from '@app/services/onlineService';

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

  // The foreground service that keeps this watch alive in the background, with
  // its "online" sign (row 68, spec 0008). Android starts it only while the app
  // is in front, so "in front" is part of when to try.
  const appActive = useAppActive();
  const tracking = mode !== TrackingMode.Off;
  // `useRef` holds a value across renders without causing one: whether the
  // service runs, and the latest mode and tracking state for async callbacks.
  const serviceRunning = useRef(false);
  const latest = useRef({ mode, tracking });
  latest.current = { mode, tracking };

  // On and off. Keyed on tracking and on the app being in front, never on the
  // mode itself, so a change between waiting and a job never stops the service
  // (decision 68.8). A refused start is tried again on the next return to the
  // front, for the mode current then (AC-6).
  useEffect(() => {
    if (!tracking) {
      if (serviceRunning.current) {
        serviceRunning.current = false;
        stopOnlineService().catch(error =>
          console.log('Could not stop the online service', error),
        );
      }
      return;
    }
    if (serviceRunning.current || !appActive) {
      return;
    }
    showOnlineService(latest.current.mode as TrackingOnMode)
      .then(() => {
        serviceRunning.current = true;
        // Tracking may have ended while Android was starting the service.
        if (!latest.current.tracking) {
          serviceRunning.current = false;
          return stopOnlineService();
        }
      })
      .catch(error => console.log('Could not start the online service', error));
  }, [tracking, appActive]);

  // The text: waiting or on a job. Updates the running service in place.
  useEffect(() => {
    if (!serviceRunning.current || mode === TrackingMode.Off) {
      return;
    }
    showOnlineService(mode).catch(error =>
      console.log('Could not update the online service', error),
    );
  }, [mode]);

  // The sign never outlives the app's screens.
  useEffect(
    () => () => {
      stopOnlineService().catch(() => undefined);
    },
    [],
  );

  return mode;
};

// True while the app is in front. Re-renders when that changes.
const useAppActive = (): boolean => {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  return active;
};

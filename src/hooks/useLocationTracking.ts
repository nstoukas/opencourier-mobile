import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Geolocation from 'react-native-geolocation-service';
import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import { filterInProgressOrdersForDisplay } from '@app/utilities/inProgressListFilter';
import { track } from '@app/utilities/geo';
import { setOwnPosition } from '@app/services/ownPosition';
import { setLatestFix } from '@app/services/latestFix';
import {
  ForwardedFix,
  TrackingMode,
  WATCH_OPTIONS,
  ordinaryModeFor,
  shouldForwardOrdinaryFix,
  trackingModeFor,
} from '@app/utilities/locationTracking';
import { addSosPoint } from '@app/services/sosStore';
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
// `sosSharing` (spec 0022): the rider's own SOS is active on the phone. The
// same one watch then runs at SOS options, whatever the status, and each fix
// is kept as an SOS point; the ordinary location still goes out only as often
// as it would without the SOS (AC-13).
export const useLocationTracking = (
  user: User | undefined,
  hasPermission: boolean,
  sosSharing = false,
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
    sosSharing,
  );
  // What dispatch would get without an SOS, read by the watch through a ref
  // so a status change during an SOS does not restart the watch.
  const ordinaryMode = ordinaryModeFor(
    user?.status,
    inProgressOrders?.length ?? 0,
    hasPermission,
  );
  const ordinaryModeNow = useRef(ordinaryMode);
  ordinaryModeNow.current = ordinaryMode;
  const courierIdNow = useRef(user?.id);
  courierIdNow.current = user?.id;

  useEffect(() => {
    if (mode === TrackingMode.Off) {
      return;
    }
    // False once this watch is stopped, so a first fix that arrives late
    // (the one shot read waits up to 15 s) is dropped, never sent.
    let active = true;
    // The last fix sent as the ordinary location during this watch.
    let lastForwarded: ForwardedFix | undefined;
    const watchId = track((point, info) => {
      if (!active) {
        return;
      }
      const latitude = point.coordinates[1];
      const longitude = point.coordinates[0];
      // The map draws the rider from the phone's own newest fix (spec 0018).
      setOwnPosition({ latitude, longitude });
      // The arrival check reads it with its accuracy and time (spec 0021).
      // Memory only: nothing more about the position is sent than before.
      setLatestFix({ latitude, longitude, ...info });
      if (mode === TrackingMode.Sos) {
        const courierId = courierIdNow.current;
        // Kept on the phone and sent by the SOS sender, to the SOS only
        // (spec 0022, AC-5, AC-13).
        if (courierId) {
          addSosPoint(courierId, {
            latitude,
            longitude,
            ...(info.accuracyMetres !== null
              ? { accuracyMetres: info.accuracyMetres }
              : {}),
            takenAt: info.at,
          }).catch(error => console.log('Could not keep an SOS point', error));
        }
        // The ordinary location, no more often than without the SOS.
        const now = Date.now();
        if (
          !shouldForwardOrdinaryFix(
            ordinaryModeNow.current,
            lastForwarded,
            { latitude, longitude },
            now,
          )
        ) {
          return;
        }
        lastForwarded = { latitude, longitude, at: now };
      }
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
    const shownMode = latest.current.mode as TrackingOnMode;
    showOnlineService(shownMode)
      .then(shown => {
        if (!shown) {
          return;
        }
        serviceRunning.current = true;
        // Tracking may have ended while Android was starting the service.
        if (!latest.current.tracking) {
          serviceRunning.current = false;
          return stopOnlineService().catch(error =>
            console.log('Could not stop the online service', error),
          );
        }
        // The mode may have changed meanwhile (a job arriving at start up),
        // and the text effect skipped it because the service was not running.
        if (latest.current.mode !== shownMode) {
          showOnlineService(latest.current.mode as TrackingOnMode).catch(
            error => console.log('Could not update the online service', error),
          );
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

  // The sign never outlives the app's screens. Resetting the mark lets the
  // effect above start it again if the hook runs again (Fast Refresh in dev).
  useEffect(
    () => () => {
      serviceRunning.current = false;
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

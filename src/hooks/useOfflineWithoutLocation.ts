import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import useUser from '@app/hooks/useUser';
import { useLocationPermission } from '@app/hooks/useLocationPermission';
import { isLocationGranted } from '@app/utilities/permissions';
import { showLocationOffAlert } from '@app/services/locationForOnline';
import { services } from '@app/services/service';
import { User, UserStatus } from '@app/types/types';

// Row 17 (spec 0039, AC-16): location switched off in the phone's settings
// while the rider was Online. When the app comes back to the front, a rider
// who is Online, holds no job and has no location permission is set Offline
// and told why, instead of sitting Online getting no offers. A rider holding a
// job is left alone: the job goes on.
//
// Android kills the app when a permission is taken away in its settings, so
// "coming back" is often a fresh start: the check runs when a rider is first
// known in this run, as well as each time the app becomes active.
// Called once, by the Router.
export const useOfflineWithoutLocation = (user: User | undefined) => {
  const { updateStatus } = useUser();
  const { requestLocationPermission } = useLocationPermission();
  // The latest values, read inside the listener without adding it again.
  const latest = useRef({ user, updateStatus, requestLocationPermission });
  latest.current = { user, updateStatus, requestLocationPermission };
  const checking = useRef(false);

  useEffect(() => {
    const check = async () => {
      const current = latest.current;
      if (checking.current || current.user?.status !== UserStatus.Online) {
        return;
      }
      checking.current = true;
      try {
        // Android reads the answer without asking; iOS answers at once, with
        // no prompt, when location is still allowed.
        const known = await isLocationGranted();
        if (known ?? (await current.requestLocationPermission())) {
          return;
        }
        // The held jobs come fresh from the server: a list not loaded yet must
        // never count as "no job". Asked directly, not through the query cache,
        // where Home's own fetch of the same list cancels this one at a cold
        // start. Without an answer (no signal), nothing changes.
        const held = await services.orderService.getInProgressOrders();
        if (held.length > 0) {
          return;
        }
        latest.current.updateStatus(UserStatus.Offline);
        showLocationOffAlert();
      } catch {
        // Leave the rider as they are.
      } finally {
        checking.current = false;
      }
    };

    check();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        check();
      }
    });
    return () => subscription.remove();
    // Again when another rider logs in on this phone.
  }, [user?.id]);
};

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiUrl, toApiUrl } from '@app/utilities/config';
import { client } from './Client';
import { clearOutbox } from './jobStepOutbox';
import { clearRiderDataOnPhone } from './session';
import { syncShiftReminders } from './shifts/shiftReminder';

// Row 17 (spec 0039, AC-3): the first start after updating from an app that let
// the rider choose a server. Older builds kept the chosen address in
// AsyncStorage (`BASE_URL`, `SOCKET_BASE_URL`); this build always uses the
// co-op's (`apiUrl`). Runs once per start, before the saved queries are restored
// and before any screen is drawn (App.tsx waits for it).
//
// A saved address for another server means the saved login, deliveries and
// waiting job steps all belong to that server: they are forgotten here, on the
// phone only, with no request to either server and no alert. The same server
// keeps everything. Either way the old keys are removed, so this does nothing
// on later starts.
// `selected_org_key` is the organization the old side menu remembered; nothing
// reads it any more.
const OLD_KEYS = ['BASE_URL', 'SOCKET_BASE_URL', 'selected_org_key'];

// Per rider notes older builds kept, keyed by the other server's ids. None could match a co-op rider,
// but `sosByRider` holds the positions of an SOS (binding value 5), so all of them go (review of
// 2026-11-19). The gate runs before any of these stores is loaded, so removing the keys is enough.
const OTHER_SERVER_KEYS = [
  'sosByRider',
  'heldArrivals',
  'answered_offer_ids',
  'cancelledJobsAlerted',
];

// Each clear runs on its own, so one failing never leaves the others undone. The outbox goes first:
// its waiting steps would otherwise be sent to this server. Answers whether every clear worked.
const forgetOtherServer = async (): Promise<boolean> => {
  const clears = [
    () => clearOutbox(),
    () => AsyncStorage.multiRemove(OTHER_SERVER_KEYS),
    // Reminders scheduled for the other server's shift bookings: an empty list cancels them all.
    () => syncShiftReminders([], 0),
    () => clearRiderDataOnPhone(client),
  ];
  let allDone = true;
  for (const clear of clears) {
    try {
      await clear();
    } catch (error) {
      allDone = false;
      console.log('Upgrade check: one clear failed', error);
    }
  }
  return allDone;
};

export const runUpgradeGate = async (): Promise<void> => {
  try {
    const saved = await AsyncStorage.getItem('BASE_URL');
    if (saved !== null && toApiUrl(saved) !== apiUrl) {
      if (!(await forgetOtherServer())) {
        // Keep the old keys, so the next start tries the failed clear again.
        return;
      }
    }
    await AsyncStorage.multiRemove(OLD_KEYS);
  } catch (error) {
    // Storage failing must not keep the app on a blank screen. The keys stay,
    // so the gate runs again on the next start.
    console.log('Upgrade check could not finish', error);
  }
};

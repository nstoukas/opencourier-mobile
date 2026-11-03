import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { Alert, Linking } from 'react-native';
import i18next from 'i18next';
import { services } from '@app/services/service';
import {
  SosRecord,
  getSosRecord,
  isSharing,
  loadSosRecord,
  resumeSos,
  startSos,
  subscribeSos,
} from '@app/services/sosStore';
import {
  SosSendOutcome,
  getLastSosOutcome,
  sendSos,
  subscribeSosOutcome,
} from '@app/services/sosSender';
import { navigationRef } from '@app/navigation/navigationRef';
import { RootScreen } from '@app/navigation/types';

// Spec 0022. How often waiting SOS positions (and a waiting start or end) are
// sent: every 5 s, the same as a point is taken (AC-5). A constant, not a
// co-op setting: it decides no pay and no assignment.
export const SOS_SEND_EVERY_MS = 5000;

// How long to wait before asking the server again whether this rider has an
// active SOS, when the launch check got no answer (no signal at launch).
export const SOS_ACTIVE_CHECK_RETRY_MS = 15000;

// The EU emergency number (decision 73.3). Android lets no app call an
// emergency number itself, so the dialer opens with it typed and the rider
// taps Call. `tel:` needs no permission.
export const EMERGENCY_DIAL_URL = 'tel:112';

// This rider's SOS on the phone, kept up to date. `useSyncExternalStore` is
// React's hook for reading a store that lives outside React: the component
// redraws whenever the store calls its listeners.
export const useSosRecord = (
  courierId: string | undefined,
): SosRecord | undefined =>
  useSyncExternalStore(subscribeSos, () => getSosRecord(courierId));

// How the last send round ended (the SOS screen's "No signal" line).
export const useSosSendOutcome = (): SosSendOutcome =>
  useSyncExternalStore(subscribeSosOutcome, getLastSosOutcome);

// Opens the phone's dialer with 112 typed (AC-3).
export const dialEmergency = (): void => {
  Linking.openURL(EMERGENCY_DIAL_URL).catch(error => {
    console.log('Could not open the dialer', error);
    Alert.alert(i18next.t('translations:sos_dialer_failed'));
  });
};

// Opens the SOS screen from anywhere. Right after a launch the navigator may
// not be ready yet, so it tries again for a few seconds.
export const openSosScreen = (triesLeft = 20): void => {
  if (navigationRef.isReady()) {
    if (navigationRef.getCurrentRoute()?.name !== RootScreen.Sos) {
      // The ref is not typed with the app's screens, so the name is cast.
      navigationRef.navigate(RootScreen.Sos as never);
    }
    return;
  }
  if (triesLeft > 0) {
    setTimeout(() => openSosScreen(triesLeft - 1), 250);
  }
};

// A random id for one SOS, made on the phone at the hold (letters, digits and
// -): the server keeps it, so a start sent twice makes one incident.
export const newSosClientId = (): string =>
  `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;

// The 3 s hold completed (AC-3): the SOS is written to the phone first (so no
// signal loses nothing), the SOS screen opens, then the dialer with 112.
// `deliveryId`: the first job the rider holds, if any.
export const beginSos = async (
  courierId: string,
  deliveryId: string | undefined,
): Promise<void> => {
  await startSos(courierId, {
    clientId: newSosClientId(),
    heldAt: Date.now(),
    ...(deliveryId ? { deliveryId } : {}),
  });
  openSosScreen();
  dialEmergency();
};

// The SOS engine, mounted once in the router beside the location watch.
// - Sends what the rider's SOS owes the server: at once after the hold or an
//   end, then every 5 s while anything is left (AC-5, AC-6).
// - After a launch or a login, picks up an SOS kept on the phone, or asks the
//   server for an active one, and reopens the SOS screen (AC-12).
// - Tells the rider when the co-op closed it (a 409 on the points).
// Returns true while the phone shares its position for an SOS: the location
// watch then runs at SOS options (AC-5).
export const useSos = (courierId: string | undefined): boolean => {
  const record = useSosRecord(courierId);
  // The rider logged in right now, read by a round already under way before
  // each request (`useRef` holds a value that survives redraws without causing one).
  const riderNow = useRef(courierId);
  riderNow.current = courierId;

  const send = useCallback(() => {
    if (!courierId) {
      return;
    }
    sendSos(courierId, services.sosService, () => riderNow.current)
      .then(outcome => {
        if (outcome === 'endedByCoop') {
          Alert.alert(i18next.t('translations:sos_ended_by_coop'));
        }
      })
      .catch(error => console.log('Could not send the SOS', error));
  }, [courierId]);

  // At once when an SOS starts (a new hold after an ended one included),
  // reaches the server, or is ended by the rider.
  const exists = !!record;
  const clientId = record?.clientId;
  const incidentId = record?.incidentId;
  const endKind = record?.end?.kind;
  useEffect(() => {
    if (exists) {
      send();
    }
  }, [exists, clientId, incidentId, endKind, send]);

  // Then every 5 s while anything of it is left on the phone.
  useEffect(() => {
    if (!exists) {
      return;
    }
    const timer = setInterval(send, SOS_SEND_EVERY_MS);
    return () => clearInterval(timer);
  }, [exists, send]);

  // After a launch or a login (AC-12). When the server cannot be asked (no
  // signal at launch), it is asked again every 15 s until it answers, so
  // sharing resumes once signal returns (row 73 review).
  useEffect(() => {
    if (!courierId) {
      return;
    }
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const check = async (): Promise<void> => {
      const kept = await loadSosRecord(courierId);
      if (kept) {
        if (!cancelled && isSharing(kept)) {
          openSosScreen();
        }
        return;
      }
      const active = await services.sosService.getActive();
      if (cancelled || !active || active.state !== 'ACTIVE') {
        return;
      }
      await resumeSos(
        courierId,
        { id: active.id, startedAt: Date.parse(active.startedAt) },
        newSosClientId(),
      );
      if (!cancelled) {
        openSosScreen();
      }
    };
    const attempt = () => {
      check().catch(error => {
        console.log('Could not check for an active SOS', error);
        if (!cancelled) {
          retry = setTimeout(attempt, SOS_ACTIVE_CHECK_RETRY_MS);
        }
      });
    };
    attempt();
    return () => {
      cancelled = true;
      if (retry) {
        clearTimeout(retry);
      }
    };
  }, [courierId]);

  return isSharing(record);
};

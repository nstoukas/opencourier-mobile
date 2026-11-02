import { Alert } from 'react-native';
import i18next from 'i18next';
import { Order } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';
import { addJobSteps } from '@app/services/jobStepOutbox';
import { dropHeldArrival, findHeldArrival } from '@app/services/heldArrivals';
import { setPickedUpAt } from '@app/services/pickupTimes';
import { JobStep, hasReachedStep } from '@app/utilities/jobSteps';
import {
  ARRIVAL_STEP,
  ArrivalStage,
  arrivalStageOf,
} from '@app/utilities/arrival';
import useUser from './useUser';

// One step to queue: when it happened (the phone's clock; now when left out)
// and whether the app detected it (an arrival only, spec 0021).
type QueueEntry = { step: JobStep; tappedAt?: number; detected?: boolean };

// The job steps of a delivery (spec 0009, spec 0021). Each one only writes the
// step to the outbox: nothing waits for the network, and the outbox sends it
// as soon as the server can be reached. `order.status` here is the status the
// screen shows (the server's, moved on by any step still waiting).
//
// A job is two swipes, "Picked up" and "Delivered" (spec 0021, AC-5). Each one
// first records the arrival at its stop when none is on record yet: the one
// the app detected and held during the hand back window, with its true time,
// or else a tapped one at the swipe's time.
const useOrder = () => {
  const { user } = useUser();

  const queue = async (
    order: Order,
    entries: QueueEntry[],
  ): Promise<boolean> => {
    if (!user?.id || entries.length === 0) {
      if (!user?.id) {
        console.log(
          'A job step was tapped with no rider loaded; nothing queued',
        );
      }
      return false;
    }
    const now = Date.now();
    try {
      await addJobSteps(
        entries.map(entry => ({
          courierId: user.id,
          deliveryId: order.id,
          step: entry.step,
          tappedAt: entry.tappedAt ?? now,
          ...(entry.detected ? { detected: true } : {}),
          restaurantName: order.pickupBusinessName || order.pickupName || '',
        })),
      );
      return true;
    } catch (error) {
      // Only the phone's own storage can fail here, never the network.
      Alert.alert(
        i18next.t('translations:step_not_saved_title'),
        String(error),
      );
      return false;
    }
  };

  // The arrival entries a step at this stop needs first, if any: none when an
  // arrival is already on record (on the server or waiting in the outbox).
  // At ACCEPTED the server has no way to the restaurant but dispatched first
  // (spec 0009, decision 20.11), so it goes before, at the same time.
  const arrivalEntries = async (
    order: Order,
    stage: ArrivalStage,
    detectedAt?: number,
  ): Promise<{ entries: QueueEntry[]; heldUsed: boolean }> => {
    const step = ARRIVAL_STEP[stage];
    if (hasReachedStep(order.status, step)) {
      return { entries: [], heldUsed: false };
    }
    let arrival: QueueEntry =
      detectedAt === undefined
        ? { step }
        : { step, tappedAt: detectedAt, detected: true };
    let heldUsed = false;
    if (stage === 'pickup' && user?.id && detectedAt === undefined) {
      // A swipe or "I'm here" during the hand back window takes the held
      // arrival with its true time (AC-12): waiting pay starts there.
      const held = await findHeldArrival(user.id, order.id).catch(() => null);
      if (held) {
        arrival = { step, tappedAt: held.firstFixAt, detected: true };
        heldUsed = true;
      }
    }
    const entries: QueueEntry[] =
      stage === 'pickup' && order.status === OrderStatus.accepted
        ? [{ step: 'dispatched', tappedAt: arrival.tappedAt }, arrival]
        : [arrival];
    return { entries, heldUsed };
  };

  // Queues the entries, then drops a held arrival that was used (or that a
  // step made pointless), so it is never sent twice.
  const queueAtStop = async (
    order: Order,
    stage: ArrivalStage,
    after: QueueEntry[],
    detectedAt?: number,
  ): Promise<boolean> => {
    const { entries, heldUsed } = await arrivalEntries(
      order,
      stage,
      detectedAt,
    );
    const queued = await queue(order, [...entries, ...after]);
    if (
      queued &&
      stage === 'pickup' &&
      user?.id &&
      (heldUsed || detectedAt === undefined)
    ) {
      await dropHeldArrival(user.id, order.id).catch(error =>
        console.log('Could not drop the held arrival', error),
      );
    }
    return queued;
  };

  // "I'm here" (AC-3): the arrival at the stop the job is heading to, tapped.
  const imHere = (order: Order): Promise<boolean> => {
    const stage = arrivalStageOf(order.status);
    return stage ? queueAtStop(order, stage, []) : Promise.resolve(true);
  };

  // The app saw the rider at the stop (AC-1): the arrival, marked detected,
  // at the time of the fix that showed it.
  const detectedArrival = (
    order: Order,
    stage: ArrivalStage,
    at: number,
  ): Promise<boolean> => queueAtStop(order, stage, [], at);

  // The first swipe (AC-5): the arrival at the restaurant if none, then the
  // pickup. Never the server's PICKED_UP shortcut without an arrival.
  // The swipe's time is kept for the card's "picked up 12:41" (review fix).
  const pickedUp = async (order: Order): Promise<boolean> => {
    const at = Date.now();
    const queued = await queueAtStop(order, 'pickup', [
      { step: 'picked_up', tappedAt: at },
    ]);
    if (queued) {
      setPickedUpAt(order.id, at);
    }
    return queued;
  };

  // The second swipe (AC-5): the arrival at the customer if none, then
  // delivered, with no note and no photo.
  const delivered = (order: Order): Promise<boolean> =>
    queueAtStop(order, 'dropoff', [{ step: 'delivered' }]);

  return { imHere, detectedArrival, pickedUp, delivered };
};

export default useOrder;

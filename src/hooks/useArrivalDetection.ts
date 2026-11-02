import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { services } from '@app/services/service';
import { QueryKeys } from '@app/utilities/queryKeys';
import { inProgressOrdersAsShown } from '@app/utilities/inProgressListFilter';
import { useOutboxItems } from './useJobStepOutbox';
import { useLatestFix } from '@app/services/latestFix';
import {
  dropHeldArrival,
  getHeldArrivals,
  holdArrival,
  keepHeldArrivalsFor,
  subscribeHeldArrivals,
} from '@app/services/heldArrivals';
import { isHandBackInFlight } from '@app/services/handBackInFlight';
import { fetchJobContact } from './useJobContact';
import {
  ARRIVAL_STEP,
  HAND_BACK_GRACE_MS,
  arrivalStageOf,
  isAtStop,
  isUsableFix,
} from '@app/utilities/arrival';
import { isHandBackWindowOpen } from '@app/utilities/handBackWindow';
import { hasReachedStep } from '@app/utilities/jobSteps';
import useOrder from './useOrder';

// Arrival detection (spec 0021, AC-1, AC-2, AC-12). Mounted once, beside the
// location watch, so it runs whatever screen is in front and, with the online
// service, in the background. For every job the rider holds (legs included,
// each on its own), it checks the newest fix against the stop the job is
// heading to, and queues the ordinary arrived step marked `detected`. Nothing
// about the position is sent: only the step (value 5).
export const useArrivalDetection = (courierId: string | undefined): void => {
  const { detectedArrival } = useOrder();
  const fix = useLatestFix();
  const outboxItems = useOutboxItems();
  const held = useSyncExternalStore(subscribeHeldArrivals, getHeldArrivals);

  // The same query and cache as Home and the location watch: no extra request.
  const { data: rawJobs, status: jobsStatus } = useQuery({
    queryFn: services.orderService.getInProgressOrders,
    queryKey: [QueryKeys.inProgressOrders],
    enabled: !!courierId,
  });
  // The co-op's radius, from the contact answer Home already polls and the
  // phone keeps for a day. Never fetched on a timer here.
  const { data: contact } = useQuery({
    queryKey: [QueryKeys.jobContact],
    queryFn: fetchJobContact,
    enabled: !!courierId,
  });
  const radius = contact?.arrivalRadiusMetres;

  const jobs = inProgressOrdersAsShown(rawJobs, outboxItems, courierId);

  // When each job was first seen heading to its stop, by `<id>:<stage>`: a
  // fix taken before that never counts (a fix by the restaurant must not
  // "arrive" at a customer next door after pickup).
  const stageSince = useRef(new Map<string, number>());
  // Arrivals queued in this run, so one fix is never queued twice while the
  // outbox catches up. Cleared for a key if queuing it failed.
  const queued = useRef(new Set<string>());
  // Bumped by the timer that releases a hold at the window's end, so the
  // check runs again even when no new fix comes.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!courierId) {
      return;
    }
    const now = Date.now();
    let nextWake: number | null = null;

    // Holds of jobs the rider no longer has (cancelled, reassigned) go, once
    // the list is really known.
    if (jobsStatus === 'success') {
      const ids = new Set(jobs.map(job => job.id));
      if (held.some(h => h.courierId !== courierId || !ids.has(h.deliveryId))) {
        keepHeldArrivalsFor(courierId, ids).catch(error =>
          console.log('Could not tidy held arrivals', error),
        );
      }
    }

    for (const job of jobs) {
      const stage = arrivalStageOf(job.status);
      const key = `${job.id}:${stage}`;
      if (!stage) {
        continue;
      }
      if (!stageSince.current.has(key)) {
        stageSince.current.set(key, now);
      }
      // A refused step of this job is still showing its card: nothing is
      // detected until the rider has seen it (spec 0021, AC-1).
      const refused = outboxItems.some(
        item =>
          item.courierId === courierId &&
          item.deliveryId === job.id &&
          item.state === 'refused',
      );
      if (refused || queued.current.has(key)) {
        continue;
      }
      if (hasReachedStep(job.status, ARRIVAL_STEP[stage])) {
        continue;
      }

      const send = (at: number) => {
        queued.current.add(key);
        detectedArrival(job, stage, at)
          .then(ok => {
            if (!ok) {
              queued.current.delete(key);
              return;
            }
            if (stage === 'pickup') {
              return dropHeldArrival(courierId, job.id);
            }
          })
          .catch(error => {
            queued.current.delete(key);
            console.log('Could not queue a detected arrival', error);
          });
      };

      const hold = held.find(
        h => h.courierId === courierId && h.deliveryId === job.id,
      );
      if (stage === 'pickup' && hold) {
        // Released at the window's end plus the server's grace, never while
        // the rider's hand back is on its way (AC-12).
        const releaseAt = (job.handBackUntilOnPhone ?? 0) + HAND_BACK_GRACE_MS;
        if (now >= releaseAt && !isHandBackInFlight(job.id)) {
          send(hold.firstFixAt);
        } else {
          const wake = Math.max(releaseAt, now + 1_000);
          nextWake = nextWake === null ? wake : Math.min(nextWake, wake);
        }
        continue;
      }

      if (
        !fix ||
        !isUsableFix(fix, stageSince.current.get(key) ?? now, now) ||
        !isAtStop(
          fix,
          stage === 'pickup' ? job.pickupLocation : job.dropoffLocation,
          radius,
        )
      ) {
        continue;
      }
      if (stage === 'pickup' && isHandBackWindowOpen(job, now)) {
        // Held, not sent: the rider keeps the free hand back (AC-12).
        holdArrival({
          courierId,
          deliveryId: job.id,
          firstFixAt: fix.at,
        }).catch(error => console.log('Could not hold the arrival', error));
        continue;
      }
      send(fix.at);
    }

    if (nextWake === null) {
      return;
    }
    const timer = setTimeout(() => setTick(t => t + 1), nextWake - now);
    return () => clearTimeout(timer);
    // `jobs` is rebuilt each render from these inputs, so they are the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courierId, fix, rawJobs, outboxItems, held, radius, jobsStatus, tick]);
};

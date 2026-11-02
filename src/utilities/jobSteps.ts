import { OrderStatus } from '@app/types/enums';

// The steps of a job a rider taps (spec 0009). Each one goes through the
// outbox (`jobStepOutbox.ts`), so it is accepted at once even with no signal.
export type JobStep =
  | 'dispatched'
  | 'arrived_at_pickup'
  | 'picked_up'
  | 'arrived_at_dropoff'
  | 'delivered';

// The courier API route each step posts to (deliveries/:id/<route>).
export const JOB_STEP_ROUTE: Record<JobStep, string> = {
  dispatched: 'mark-as-dispatched',
  arrived_at_pickup: 'arrived-at-pickup',
  picked_up: 'mark-as-picked-up',
  arrived_at_dropoff: 'arrived-at-dropoff',
  delivered: 'mark-as-delivered',
};

// The status a delivery reaches when the server accepts the step.
export const JOB_STEP_TARGET: Record<JobStep, OrderStatus> = {
  dispatched: OrderStatus.dispatched,
  arrived_at_pickup: OrderStatus.courier_arrived_at_pickup_location,
  picked_up: OrderStatus.picked_up,
  arrived_at_dropoff: OrderStatus.courier_arrived_at_dropoff_location,
  delivered: OrderStatus.dropped_off,
};

// The translation key naming each step to the rider (the refusal card).
export const JOB_STEP_LABEL_KEY: Record<JobStep, string> = {
  dispatched: 'translations:step_dispatched',
  arrived_at_pickup: 'translations:arrived_at_pickup',
  picked_up: 'translations:swipe_picked_up',
  arrived_at_dropoff: 'translations:step_arrived_at_dropoff',
  delivered: 'translations:swipe_delivered',
};

// A job's statuses in the order they happen (spec 0009). A status not in this
// list (CREATED, CANCELED, FAILED) is not a step of the job, so it is never
// "at or past" any step.
const JOB_ORDER: string[] = [
  OrderStatus.accepted,
  OrderStatus.dispatched,
  OrderStatus.courier_arrived_at_pickup_location,
  OrderStatus.picked_up,
  OrderStatus.on_the_way,
  OrderStatus.courier_arrived_at_dropoff_location,
  OrderStatus.dropped_off,
];

// Where a status sits in the job, or -1 when it is not a job step.
export const jobRank = (status: string | undefined): number =>
  status === undefined ? -1 : JOB_ORDER.indexOf(status);

// True when `status` is the step's own status or a later one: the step has
// taken effect on the server (it may be a repeat after a lost answer).
export const hasReachedStep = (
  status: string | undefined,
  step: JobStep,
): boolean => {
  const rank = jobRank(status);
  return rank >= 0 && rank >= jobRank(JOB_STEP_TARGET[step]);
};

// What the screen shows for a delivery: the later of the server's status and
// the target of the latest step still waiting to be sent. So a refetch while
// a step waits never moves the screen back (spec 0009, AC-2). A server status
// that is not a job step (CANCELED) wins: the rider must see it.
export const shownStatus = (
  serverStatus: string,
  waitingSteps: JobStep[],
): string => {
  const serverRank = jobRank(serverStatus);
  if (serverRank < 0) {
    return serverStatus;
  }
  let shown: string = serverStatus;
  for (const step of waitingSteps) {
    const target = JOB_STEP_TARGET[step];
    if (jobRank(target) > jobRank(shown)) {
      shown = target;
    }
  }
  return shown;
};

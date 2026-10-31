import { Alert } from 'react-native';
import i18next from 'i18next';
import { Order } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';
import { addJobSteps } from '@app/services/jobStepOutbox';
import { JobStep, jobRank } from '@app/utilities/jobSteps';
import useUser from './useUser';

// The job steps a rider taps. Each tap only writes the step to the outbox
// (spec 0009): nothing waits for the network, and the outbox sends it as soon
// as the server can be reached. `order.status` here is the status the screen
// shows (the server's, moved on by any step still waiting).
const useOrder = () => {
  const { user } = useUser();

  const queue = async (
    order: Order,
    steps: JobStep[],
    note?: string,
  ): Promise<boolean> => {
    if (!user?.id || steps.length === 0) {
      if (!user?.id) {
        console.log(
          'A job step was tapped with no rider loaded; nothing queued',
        );
      }
      return false;
    }
    const tappedAt = Date.now();
    try {
      await addJobSteps(
        steps.map((step, index) => ({
          courierId: user.id,
          deliveryId: order.id,
          step,
          tappedAt,
          // The note goes with the last step only (the delivered screen's).
          ...(note && index === steps.length - 1 ? { note } : {}),
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

  // An accepted delivery is dispatched first: the server has no other way
  // from ACCEPTED to the pickup (spec 0009, decision 20.11).
  const withDispatch = (order: Order, step: JobStep): JobStep[] =>
    order.status === OrderStatus.accepted ? ['dispatched', step] : [step];

  const arrivedAtPickup = (order: Order) =>
    queue(order, withDispatch(order, 'arrived_at_pickup'));

  const confirmOrderItems = (order: Order) =>
    queue(order, withDispatch(order, 'picked_up'));

  // Mark as delivered first records arriving at the customer, unless the
  // delivery is already there (the rider came back to the delivered screen).
  const arrivedAtDropoff = (order: Order) =>
    jobRank(order.status) <
    jobRank(OrderStatus.courier_arrived_at_dropoff_location)
      ? queue(order, ['arrived_at_dropoff'])
      : Promise.resolve(true);

  const markAsDelivered = (order: Order, note: string) =>
    queue(order, ['delivered'], note);

  return {
    arrivedAtPickup,
    confirmOrderItems,
    arrivedAtDropoff,
    markAsDelivered,
  };
};

export default useOrder;

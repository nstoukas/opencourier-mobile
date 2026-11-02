import React, { useState } from 'react';
import {
  StyleProp,
  ViewStyle,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { styles } from './NextStep.styles';
import { useTranslation } from 'react-i18next';
import { Order, ToastMessage, User } from '@app/types/types';
import { Button, ButtonType } from '../Button/Button';
import ButtonSwipe from '../ButtonSwipe/ButtonSwipe';
import { Toast } from '../Toast/Toast';
import { OrderStatus } from '@app/types/enums';
import useOrder from '@app/hooks/useOrder';
import { MainNavigationProp, MainScreens } from '@app/navigation/main/types';
import { useNavigation } from '@react-navigation/native';
import { Icon } from '@app/components/Icon/Icon';
import { CaretCircleDoubleRightIcon } from 'phosphor-react-native/src/icons/CaretCircleDoubleRight';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { CloudArrowUpIcon } from 'phosphor-react-native/src/icons/CloudArrowUp';

type Props = {
  style?: StyleProp<ViewStyle>;
  order: Order;
  onReportIssue?: (order: Order) => void;
  onOrderItemsListForCustomer: () => void;
  // What the items line calls the customer instead of their name: the drop
  // off area during the free hand back (spec 0020, decision 71.10).
  customerTitle?: string;
};

export const NextStep = ({
  style,
  order,
  onReportIssue,
  onOrderItemsListForCustomer,
  customerTitle,
}: Props) => {
  const { t } = useTranslation();
  const navigation = useNavigation<MainNavigationProp>();

  // Each tap is accepted at once and sent when there is signal (spec 0009),
  // so nothing here waits for an answer. `order.status` is the status the
  // screen shows, already moved on by any step still waiting to be sent.
  const { confirmOrderItems, arrivedAtPickup, arrivedAtDropoff } = useOrder();

  // Spec 0018: after a swipe's step has run, draw the swipe fresh (a new key).
  // When the status moved on the key changes anyway; when the step was
  // refused, or the rider came back from a screen without finishing, this
  // brings the knob back to the start instead of leaving it at the end.
  const [swipeAttempt, setSwipeAttempt] = useState(0);
  const swipeKey = `${order.id}-${order.status}-${swipeAttempt}`;
  const runSwipe = async (didSwipe: boolean, step: () => unknown) => {
    if (!didSwipe) {
      return;
    }
    await step();
    setSwipeAttempt(attempt => attempt + 1);
  };

  const userCell = () => {
    if (!order.orderItems) {
      return;
    }
    return (
      <TouchableOpacity
        style={styles.cell}
        onPress={() => onOrderItemsListForCustomer()}>
        <Icon icon={CheckCircleIcon} weight="fill" size={20} tone="success" />
        <View style={styles.cellText}>
          <Text style={styles.cellName}>
            {customerTitle ?? order.dropoffName}
          </Text>
          <Text style={styles.cellItems}>
            {`${order.orderItems.length} ` +
              (order.orderItems.length > 1 ? 'items' : 'item')}
          </Text>
        </View>
        <Icon icon={CaretRightIcon} />
      </TouchableOpacity>
    );
  };

  const onMarkAsDelivered = async () => {
    if (await arrivedAtDropoff(order)) {
      navigation.navigate(MainScreens.MarkAsDelivered, { order });
    }
  };

  const showPrePickupActions =
    order.status === OrderStatus.dispatched ||
    order.status === OrderStatus.accepted ||
    order.status === OrderStatus.courier_arrived_at_pickup_location;

  const isCourierArrivedAtPickup =
    order.status === OrderStatus.courier_arrived_at_pickup_location;

  const showConfirmOrderItems =
    showPrePickupActions && isCourierArrivedAtPickup;

  const showArrivedAtPickupButton =
    showPrePickupActions && !isCourierArrivedAtPickup;

  // From picked up until delivered, so a rider who backs out of the delivered
  // screen (the delivery is then at the customer) can come back to it.
  const showDeliveredActions =
    order.status === OrderStatus.picked_up ||
    order.status === OrderStatus.on_the_way ||
    order.status === OrderStatus.courier_arrived_at_dropoff_location;

  return (
    <View style={styles.nextStep}>
      <View style={styles.blueSeparator} />
      <View style={styles.flexRow}>
        <Icon icon={CaretCircleDoubleRightIcon} size={32} tone="info" />
        <Text style={styles.textNextStep}>Next Step</Text>
      </View>
      {/* {showPrePickupActions && (
        <Toast
          toast={ToastMessage.get_closer}
          disableClose
          style={{ marginBottom: 10 }}
        />
      )} */}
      {order.waitingToSend && (
        <View style={styles.waiting} accessibilityRole="text">
          <Icon icon={CloudArrowUpIcon} size={20} />
          <Text style={styles.waitingText}>
            {order.status === OrderStatus.dropped_off
              ? t('translations:delivered_waiting_to_send')
              : t('translations:waiting_to_send')}
          </Text>
        </View>
      )}
      {showPrePickupActions && userCell()}
      {/* Spec 0018 (AC-9): each main step is a swipe, so it cannot fire by
          accident; let go early and nothing happens. The key is the delivery
          and its status, so each new step starts with the knob at the start. */}
      {showArrivedAtPickupButton && (
        <ButtonSwipe
          key={swipeKey}
          style={styles.swipe}
          isSwiped={false}
          onSwiped={didSwipe =>
            runSwipe(didSwipe, () => arrivedAtPickup(order))
          }
          enabled={true}
          title={t('translations:arrived_at_pickup')}
          isLoading={false}
        />
      )}
      {showConfirmOrderItems && (
        <ButtonSwipe
          key={swipeKey}
          style={styles.swipe}
          isSwiped={false}
          onSwiped={didSwipe =>
            runSwipe(didSwipe, () => confirmOrderItems(order))
          }
          enabled={true}
          title={t('translations:confirm_items')}
          isLoading={false}
        />
      )}
      {showDeliveredActions && (
        <>
          <ButtonSwipe
            key={swipeKey}
            style={styles.swipe}
            isSwiped={false}
            onSwiped={didSwipe => runSwipe(didSwipe, onMarkAsDelivered)}
            enabled={true}
            title={t('translations:arrived_at_customer')}
            isLoading={false}
          />
          <Button
            style={{ marginHorizontal: 12, marginTop: 10 }}
            type={ButtonType.redBGRedText}
            title={t('translations:report_issue')}
            onPress={() => onReportIssue && onReportIssue(order)}
          />
        </>
      )}
    </View>
  );
};

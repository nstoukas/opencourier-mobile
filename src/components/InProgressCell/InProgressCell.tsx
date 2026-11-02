import React, { useState } from 'react';
import { StyleProp, Text, ViewStyle, View } from 'react-native';
import { styles } from './InProgressCell.styles';
import { Note, Order } from '@app/types/types';
import { useTranslation } from 'react-i18next';
import { InProgressCellHeader } from '../InProgressCellHeader/InProgressCellHeader';
import { InProgressAdress } from '../InProgressAddress/InProgressAddress';
import { InProgressNotes } from '../InProgressNotes/InProgressNotes';
import { NextStep } from '../NextStep/NextStep';
import { OrderStatus } from '@app/types/enums';
import { StorefrontIcon } from 'phosphor-react-native/src/icons/Storefront';
import { HouseLineIcon } from 'phosphor-react-native/src/icons/HouseLine';
import { HeadsetIcon } from 'phosphor-react-native/src/icons/Headset';
import { Button, ButtonType } from '../Button/Button';
import { isJobOver } from '@app/utilities/jobContact';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { NavigationArrowIcon } from 'phosphor-react-native/src/icons/NavigationArrow';
import { RouteLines } from '../RouteLines/RouteLines';
import { LegFigures } from '@app/utilities/routeLegs';

type Props = {
  style?: StyleProp<ViewStyle>;
  order: Order;
  onCustomerAddressPress: (order: Order) => void;
  onRestaurantAddressPress: (order: Order) => void;
  onMessageRestaurant: (order: Order) => void;
  onCallRestaurant: (order: Order) => void;
  onMessageCustomer: (order: Order) => void;
  onCallCustomer: (order: Order) => void;
  // Opens the preset messages for the customer (row 72); left out, no message button.
  onTextCustomer?: (order: Order) => void;
  // Left out when the co-op has set no dispatch number: the button is not shown (row 72).
  onCallDispatch?: () => void;
  onOrderItemsListForCustomer: () => void;
  onReportIssue: (order: Order) => void;
  // Spec 0016: "Pin wrong? Set it where I stand". Left out, no button.
  onMovePin?: (order: Order) => void;
  // True while this delivery's pin move runs: the button spins and ignores taps.
  movingPin?: boolean;
  // Spec 0018 (AC-7): the distance lines, from the co-op's route.
  toRestaurant?: LegFigures;
  toCustomer?: LegFigures;
  routeUnavailable?: boolean;
  // Spec 0018 (AC-12): opens the rider's navigation app toward the next stop.
  onNavigate?: (order: Order) => void;
};

// Spec 0016 (AC-8): the pin can be moved while the shown status is "arrived at
// drop off" (the rider stands at the door), once per delivery.
export const canMoveDropoffPin = (order: Order): boolean =>
  order.status === OrderStatus.courier_arrived_at_dropoff_location &&
  !order.dropoffPointCorrectedAt;

export const InProgressCell = ({
  style,
  order,
  onCustomerAddressPress,
  onRestaurantAddressPress,
  onMessageCustomer,
  onMessageRestaurant,
  onCallCustomer,
  onCallRestaurant,
  onTextCustomer,
  onCallDispatch,
  onOrderItemsListForCustomer,
  onReportIssue,
  onMovePin,
  movingPin,
  toRestaurant,
  toCustomer,
  routeUnavailable = false,
  onNavigate,
}: Props) => {
  const { t } = useTranslation();
  const [topExpanded, setTopExpanded] = useState<boolean>(true);
  const [bottomExpanded, setBottomExpanded] = useState<boolean>(false);

  // No way to contact anyone once the job is over (row 72), counting a drop off still waiting
  // for signal (row 33 review). The customer's number is also gone before the rider holds the
  // delivery (row 33), so the customer's buttons need the number too.
  const jobOver = isJobOver(order.status);
  const canReachCustomer = !!order.dropoffPhoneNumber && !jobOver;
  const canReachRestaurant = !!order.pickupPhoneNumber && !jobOver;

  return (
    <View style={[styles.container, style]}>
      <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
        {/* Spec 0018: the road ahead, and one tap to the rider's navigation app.
            The full screen map behind home replaces the small map that was here. */}
        <RouteLines
          toRestaurant={toRestaurant}
          toCustomer={toCustomer}
          unavailable={routeUnavailable}
        />
        {onNavigate && !jobOver ? (
          <Button
            style={styles.dispatchButton}
            type={ButtonType.white}
            icon={NavigationArrowIcon}
            iconWeight="fill"
            title={t('translations:navigate')}
            onPress={() => onNavigate(order)}
          />
        ) : null}
        <InProgressCellHeader
          title={order.dropoffName ?? 'N/A'}
          icon={StorefrontIcon}
          expanded={topExpanded}
          onExpandedPress={() => setTopExpanded(!topExpanded)}
          finished={order.status === OrderStatus.picked_up}
        />
        <View style={styles.containerContentRestaurant}>
          <View style={styles.containerLeft}>
            <View style={styles.verticalLine} />
          </View>
          <View style={styles.containerInfo}>
            <View style={[styles.colapsable]}>
              <InProgressAdress
                order={order}
                customerOrRestaurant="restaurant"
                onAddressPress={() => onRestaurantAddressPress(order)}
                onCall={
                  canReachRestaurant ? () => onCallRestaurant(order) : undefined
                }
                onCopyAddress={() => onMessageRestaurant(order)}
                expanded={topExpanded}
              />
              <InProgressNotes
                order={order}
                notes={order.pickupNotes ? [order.pickupNotes] : []}
                headerTitle={t('translations:restaurant_notes')}
                expanded={topExpanded}
                noteCreationDisabled={true}
              />
              <InProgressNotes
                order={order}
                notes={order.pickupLocationNotes}
                headerTitle={t('translations:location_courier_notes')}
                expanded={topExpanded}
                noteCreationDisabled={false}
                type="merchant"
              />
            </View>
          </View>
        </View>
        <InProgressCellHeader
          title={order.dropoffBusinessName ?? 'N/A'}
          icon={HouseLineIcon}
          expanded={bottomExpanded}
          onExpandedPress={() => setBottomExpanded(!bottomExpanded)}
          finished={order.status === OrderStatus.dropped_off}
        />
        <View style={styles.containerContentRestaurant}>
          <View style={styles.containerLeft} />
          <View style={styles.containerInfo}>
            <View style={[styles.colapsable]}>
              <InProgressAdress
                order={order}
                customerOrRestaurant="customer"
                onAddressPress={() => onCustomerAddressPress(order)}
                onCall={
                  canReachCustomer ? () => onCallCustomer(order) : undefined
                }
                onText={
                  canReachCustomer && onTextCustomer
                    ? () => onTextCustomer(order)
                    : undefined
                }
                onCopyAddress={() => onMessageCustomer(order)}
                expanded={bottomExpanded}
              />
              {/* Spec 0016 (AC-7): floor and doorbell on their own lines, above the notes. */}
              {order.dropoffFloor ? (
                <Text style={styles.dropoffDetail}>
                  {t('translations:dropoff_floor', {
                    floor: order.dropoffFloor,
                  })}
                </Text>
              ) : null}
              {order.dropoffDoorbell ? (
                <Text style={styles.dropoffDetail}>
                  {t('translations:dropoff_doorbell', {
                    doorbell: order.dropoffDoorbell,
                  })}
                </Text>
              ) : null}
              {onMovePin && canMoveDropoffPin(order) ? (
                <Button
                  style={styles.movePinButton}
                  type={ButtonType.white}
                  icon={MapPinIcon}
                  title={t('translations:pin_wrong_button')}
                  isLoading={movingPin}
                  disabled={movingPin}
                  onPress={() => onMovePin(order)}
                />
              ) : null}
              <InProgressNotes
                order={order}
                notes={
                  order.dropoffSellerNotes ? [order.dropoffSellerNotes] : []
                }
                headerTitle={t('translations:customer_notes')}
                expanded={bottomExpanded}
                noteCreationDisabled={true}
              />
              <InProgressNotes
                order={order}
                notes={order.dropOffLocationNotes}
                headerTitle={t('translations:location_courier_notes')}
                expanded={bottomExpanded}
                noteCreationDisabled={false}
                type="location"
              />
            </View>
          </View>
        </View>
      </View>
      {onCallDispatch && !jobOver ? (
        <Button
          style={styles.dispatchButton}
          type={ButtonType.white}
          icon={HeadsetIcon}
          iconWeight="fill"
          title={t('translations:call_dispatch')}
          onPress={onCallDispatch}
        />
      ) : null}
      <NextStep
        order={order}
        onOrderItemsListForCustomer={() => onOrderItemsListForCustomer()}
        onReportIssue={() => onReportIssue(order)}
      />
    </View>
  );
};

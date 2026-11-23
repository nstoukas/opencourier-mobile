import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { NoteStop, Order } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';
import { Icon } from '@app/components/Icon/Icon';
import { Button, ButtonType } from '@app/components/Button/Button';
import { StageStrip } from '@app/components/StageStrip/StageStrip';
import {
  AddressNoteActions,
  JobNotesLine,
} from '@app/components/JobNotesLine/JobNotesLine';
import { JobItemsLine } from '@app/components/JobItemsLine/JobItemsLine';
import { boxSizeLine } from '@app/utilities/boxSize';
import { legLine } from '@app/utilities/legs';
import { ReadyLine } from '@app/components/ReadyLine/ReadyLine';
import { PhoneIcon } from 'phosphor-react-native/src/icons/Phone';
import { ChatTextIcon } from 'phosphor-react-native/src/icons/ChatText';
import { NavigationArrowIcon } from 'phosphor-react-native/src/icons/NavigationArrow';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { isJobOver } from '@app/utilities/jobContact';
import { LegFigures } from '@app/utilities/routeLegs';
import { hidesCustomerDetails } from '@app/utilities/handBackWindow';
import { useHandBackCountdown } from '@app/hooks/useHandBack';
import { getPickedUpAt } from '@app/services/pickupTimes';
import {
  cardStageOf,
  firstNameOf,
  notesFor,
  orderCodeOf,
} from '@app/utilities/jobCard';
import { color, control, radius, space, typeScale } from '@app/styles/theme';
import { coopClock } from '@app/utilities/timeWorked';

type Props = {
  style?: StyleProp<ViewStyle>;
  order: Order;
  onCallRestaurant: (order: Order) => void;
  onCallCustomer: (order: Order) => void;
  // Opens the preset messages for the customer (row 72); left out, no message icon.
  onTextCustomer?: (order: Order) => void;
  // Spec 0018 (AC-12): opens the rider's navigation app toward the next stop.
  onNavigate?: (order: Order) => void;
  // Spec 0016: "Pin wrong? Set it where I stand". Left out, no button.
  onMovePin?: (order: Order) => void;
  // True while this delivery's pin move runs: the button spins and ignores taps.
  movingPin?: boolean;
  // Spec 0053: upvote, flag, add, edit and delete for the riders' notes on a stop. Left out, the
  // notes are plain text.
  addressNotesFor?: (order: Order, stop: NoteStop) => AddressNoteActions;
  // Spec 0018 (AC-7): each leg's km, from the co-op's route.
  toRestaurant?: LegFigures;
  toCustomer?: LegFigures;
  // The route could not be had (OSRM down, no signal): the card says so
  // instead of the km (spec 0018, AC-6).
  routeUnavailable?: boolean;
  // Row 138: the job's ⋯ button (`JobActionsButton`), drawn at the right of the current
  // stop's address. Left out, nothing is drawn there.
  actionsButton?: React.ReactNode;
};

// Spec 0016 (AC-8): the pin can be moved while the shown status is "arrived at
// drop off" (the rider stands at the door), once per delivery.
export const canMoveDropoffPin = (order: Order): boolean =>
  order.status === OrderStatus.courier_arrived_at_dropoff_location &&
  !order.dropoffPointCorrectedAt;

// The time of day a step happened, on the co-op's 24 hour clock (spec 0054, AC-3: it used the
// phone's own locale, which could show "1:05 PM").
const timeOf = (at: number): string =>
  Number.isNaN(new Date(at).getTime()) ? '' : coopClock(at);

type IconActionProps = {
  icon: React.ComponentProps<typeof Icon>['icon'];
  label: string;
  onPress: () => void;
  testID: string;
};

// A round icon button, 48 px so it works with gloves (spec 0021, AC-8), and
// never bigger than the address beside it.
const IconAction = ({ icon, label, onPress, testID }: IconActionProps) => (
  <TouchableOpacity
    style={styles.iconAction}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    testID={testID}>
    <Icon icon={icon} size={22} />
  </TouchableOpacity>
);

// The job card (spec 0021, AC-6 to AC-8, AC-14): one stop at a time, the
// person at that stop leading. At the restaurant, the order code and the
// customer's first name (the bag's label); at the door, the customer's name,
// address, floor and doorbell. Notes and items are one line each. The swipe is
// not here: it sits in the card's pinned footer (`JobFooter`), so it never
// scrolls away. The small actions sit behind the ⋯ button beside the address (row 138).
export const InProgressCell = ({
  style,
  order,
  onCallRestaurant,
  onCallCustomer,
  onTextCustomer,
  onNavigate,
  onMovePin,
  movingPin,
  addressNotesFor,
  toRestaurant,
  toCustomer,
  routeUnavailable = false,
  actionsButton,
}: Props) => {
  const { t } = useTranslation();
  const stage = cardStageOf(order.status);

  // No way to contact anyone once the job is over (row 72), counting a drop off
  // still waiting for signal. The customer's number only comes while the rider
  // holds the delivery (row 33), so each button also needs its number.
  const jobOver = isJobOver(order.status);
  const canReachCustomer = !!order.dropoffPhoneNumber && !jobOver;
  const canReachRestaurant = !!order.pickupPhoneNumber && !jobOver;
  // Spec 0053 (AC-2): notes can be added and voted on only while the rider holds the job.
  const addressNotesOf = (stop: NoteStop) =>
    addressNotesFor && !jobOver ? addressNotesFor(order, stop) : undefined;

  // Drawn again each second while the free hand back window is open, so the
  // customer's first name appears the moment it ends (decision 71.10).
  useHandBackCountdown(order.handBackUntilOnPhone);
  const hideCustomer = hidesCustomerDetails(order, Date.now());

  const restaurantName = order.pickupBusinessName || order.pickupName || '';
  const restaurantAddress =
    order.pickupLocationFormattedAddress ??
    order.pickupLocation?.formattedAddress ??
    '';
  const customerAddress =
    order.dropoffLocationFormattedAddress ??
    order.dropoffLocation?.formattedAddress ??
    '';
  const firstName = firstNameOf(order.dropoffName);
  // Spec 0046 (AC-7): "Leg 1 of 2" when the order goes as several deliveries.
  const leg = legLine(order, t);
  const pickedUpAt = getPickedUpAt(order.id);
  const floorAndBell = [
    order.dropoffFloor
      ? t('translations:dropoff_floor', { floor: order.dropoffFloor })
      : '',
    order.dropoffDoorbell
      ? t('translations:dropoff_doorbell', { doorbell: order.dropoffDoorbell })
      : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.container, style]} testID={`job-card-${stage}`}>
      <StageStrip
        stage={stage}
        toRestaurant={toRestaurant}
        toCustomer={toCustomer}
      />
      {routeUnavailable && !toRestaurant && !toCustomer ? (
        <Text style={styles.secondary} testID="route-unavailable">
          {t('translations:route_not_available')}
        </Text>
      ) : null}
      {/* Spec 0046 (AC-7): at every step, so the rider knows at the door too
          that a colleague brings the rest. */}
      {leg !== '' ? (
        <Text style={styles.secondary} testID="job-leg">
          {leg}
        </Text>
      ) : null}

      {stage === 'pickup' ? (
        <View style={styles.hero}>
          <View style={styles.codeRow}>
            <Text
              style={styles.code}
              accessibilityLabel={t('translations:order_code_label', {
                code: orderCodeOf(order.id),
              })}
              testID="job-order-code">
              {`#${orderCodeOf(order.id)}`}
            </Text>
            {!hideCustomer && firstName ? (
              <Text style={styles.forName} testID="job-first-name">
                {t('translations:order_for', { name: firstName })}
              </Text>
            ) : null}
          </View>
          {/* Spec 0023 (AC-7): is the food ready yet? Only on the way to the
              restaurant and while waiting there. */}
          <ReadyLine
            foodReadyAt={order.foodReadyAt}
            readyAtOnPhone={order.readyAtOnPhone}
          />
          {/* Spec 0043 (AC-7): the size, at the restaurant where it matters
              (after pickup it is already in the box). */}
          {boxSizeLine(order.boxSize, t) !== '' ? (
            <Text style={styles.secondary} testID="job-box-size">
              {boxSizeLine(order.boxSize, t)}
            </Text>
          ) : null}
          {/* Row 138: the job's actions at the right of the address. */}
          <View style={styles.addressRow}>
            <Text
              style={[styles.secondary, styles.addressText]}
              // Three lines: the ⋯ button beside it takes some width (row 138 review).
              numberOfLines={3}>
              {[restaurantName, restaurantAddress].filter(Boolean).join(' · ')}
            </Text>
            {actionsButton}
          </View>
          <View style={styles.actions}>
            {canReachRestaurant ? (
              <IconAction
                icon={PhoneIcon}
                label={t('translations:call_restaurant')}
                onPress={() => onCallRestaurant(order)}
                testID="job-call-restaurant"
              />
            ) : null}
            {onNavigate && !jobOver ? (
              <IconAction
                icon={NavigationArrowIcon}
                label={t('translations:navigate')}
                onPress={() => onNavigate(order)}
                testID="job-navigate"
              />
            ) : null}
          </View>
          <JobItemsLine deliveryId={order.id} items={order.orderItems} />
          <JobNotesLine
            notes={notesFor(order, 'pickup')}
            addressNotes={addressNotesOf('PICKUP')}
          />
        </View>
      ) : (
        <View style={styles.hero}>
          {/* Row 138: the job's actions at the right of the customer and the address. */}
          <View style={styles.addressRow}>
            <View style={styles.addressText}>
              {/* Row 142 review: the server sends the name only while the rider holds the job. */}
              {order.dropoffName ? (
                <Text style={styles.name} testID="job-customer-name">
                  {order.dropoffName}
                </Text>
              ) : null}
              {customerAddress ? (
                <Text style={styles.address}>{customerAddress}</Text>
              ) : null}
              {floorAndBell ? (
                <Text style={styles.address} testID="job-floor-bell">
                  {floorAndBell}
                </Text>
              ) : null}
            </View>
            {actionsButton}
          </View>
          <View style={styles.actions}>
            {canReachCustomer ? (
              <IconAction
                icon={PhoneIcon}
                label={t('translations:call_customer')}
                onPress={() => onCallCustomer(order)}
                testID="job-call-customer"
              />
            ) : null}
            {canReachCustomer && onTextCustomer ? (
              <IconAction
                icon={ChatTextIcon}
                label={t('translations:text_customer')}
                onPress={() => onTextCustomer(order)}
                testID="job-text-customer"
              />
            ) : null}
            {onNavigate && !jobOver ? (
              <IconAction
                icon={NavigationArrowIcon}
                label={t('translations:navigate')}
                onPress={() => onNavigate(order)}
                testID="job-navigate"
              />
            ) : null}
          </View>
          <JobNotesLine
            notes={notesFor(order, 'dropoff')}
            addressNotes={addressNotesOf('DROPOFF')}
          />
          {onMovePin && canMoveDropoffPin(order) ? (
            <Button
              style={styles.movePin}
              type={ButtonType.white}
              icon={MapPinIcon}
              title={t('translations:pin_wrong_button')}
              isLoading={movingPin}
              disabled={movingPin}
              onPress={() => onMovePin(order)}
            />
          ) : null}
          <View style={styles.restaurantLine} testID="job-restaurant-line">
            <Text style={styles.secondary} numberOfLines={1}>
              {/* The time the rider swiped Picked up on this phone. Never pickupReadyAt: that is
                  the restaurant's planned ready time (review fix). Unknown after a restart: name only. */}
              {pickedUpAt !== undefined
                ? t('translations:picked_up_at', {
                    restaurant: restaurantName,
                    time: timeOf(pickedUpAt),
                  })
                : restaurantName}
            </Text>
            {canReachRestaurant ? (
              <IconAction
                icon={PhoneIcon}
                label={t('translations:call_restaurant')}
                onPress={() => onCallRestaurant(order)}
                testID="job-call-restaurant"
              />
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space['4'],
    paddingTop: space['2'],
    gap: space['3'],
  },
  hero: {
    gap: space['1'],
  },
  // The address (or the customer and the address) beside the ⋯ button (row 138).
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['3'],
  },
  // Takes the room the button leaves, so a long address wraps instead of pushing it off.
  addressText: {
    flex: 1,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: space['3'],
  },
  code: {
    ...typeScale.h1,
    color: color.foreground,
    fontVariant: ['tabular-nums'],
  },
  forName: {
    ...typeScale.h3,
    color: color.foreground,
  },
  name: {
    ...typeScale.h2,
    color: color.foreground,
  },
  address: {
    ...typeScale.lead,
    color: color.foreground,
  },
  secondary: {
    ...typeScale['body-sm'],
    color: color['muted-foreground'],
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: space['2'],
    marginVertical: space['1'],
  },
  iconAction: {
    width: control.xl,
    height: control.xl,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  movePin: {
    marginTop: space['1'],
  },
  restaurantLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space['2'],
    marginTop: space['2'],
    borderTopWidth: 1,
    borderTopColor: color.border,
    paddingTop: space['2'],
  },
});

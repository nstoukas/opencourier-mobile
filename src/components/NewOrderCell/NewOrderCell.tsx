import React, { useEffect, useState } from 'react';
import {
  StyleProp,
  ViewStyle,
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { styles } from './NewOrderCell.styles';
import { Order } from '@app/types/types';
import { ButtonOrder, ButtonOrderType } from '../ButtonOrder/ButtonOrder';
import { Images } from '@app/utilities/images';
import Map from '../Map/Map';
import { useTranslation } from 'react-i18next';
import { metersToMiles } from '@app/utilities/geo';
import { secondsToMinutes } from '@app/utilities/dates';
import { getDistance } from '@app/utilities/geo';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import { SCREEN_WIDTH } from '@app/utilities/constants';
import { Paralelogram } from '../Paralelogram/Paralelogram';
import { Colors } from '@app/styles/colors';
import useUser from '@app/hooks/useUser';
import { useCountdownBar } from '@app/hooks/useCountdownBar';

const PARALELOGRAM_WIDTH = 16;
const PARALELOGRAM_HEIGHT = 8;

const PROGRESS_BAR_WIDTH = SCREEN_WIDTH - 54;

type Props = {
  style?: StyleProp<ViewStyle>;
  order: Order;
  autoAcceptOrders: boolean;
  onAccept: (order: Order) => void;
  onDecline: (order: Order) => void;
  onCopyCustomer: (order: Order) => void;
  onCopyRestaurant: (order: Order) => void;
  // Time left before the server's deadline; null when the offer has no
  // deadline (Offer expiry off), and then no bar is drawn (spec 0002).
  millisRemaining?: number | null;
  // The whole countdown length, so the bar starts at the share already used.
  totalMillis?: number | null;
  // How long the offer has waited, for the "Waiting X min" line shown when
  // there is no deadline (AC-4).
  millisWaited?: number | null;
};

// "Waiting 3 min", or "Waiting less than 1 min" for a fresh offer.
const waitingText = (
  millisWaited: number,
  t: (key: string, options?: Record<string, unknown>) => string,
) => {
  const minutes = Math.floor(millisWaited / 60000);
  return minutes < 1
    ? t('translations:offer_waiting_just_now')
    : t('translations:offer_waiting_minutes', { minutes });
};

export const NewOrderCell = ({
  style,
  order,
  onAccept,
  onDecline,
  autoAcceptOrders,
  onCopyCustomer,
  onCopyRestaurant,
  millisRemaining = null,
  totalMillis = null,
  millisWaited = null,
}: Props) => {
  const { t } = useTranslation();
  const { user } = useUser();
  const [distance, setDistance] = useState<number>(0); // meters
  const [duration, setDuration] = useState<number>(0); // seconds
  const numberOfParalelograms = Math.floor(SCREEN_WIDTH / PARALELOGRAM_WIDTH);

  // An offer with a deadline shows a countdown bar; one without shows how
  // long it has waited instead.
  const hasDeadline = millisRemaining !== null;
  const widthAnimation = useCountdownBar(
    millisRemaining ?? 0,
    totalMillis ?? 0,
    PROGRESS_BAR_WIDTH,
  );

  const paralelogramColor = (index: number) => {
    const even = index % 2 === 0;
    return even ? Colors.gray8 : Colors.gray23;
  };

  useEffect(() => {
    if (
      user!.currentLocation &&
      order.pickupLocation &&
      order.dropoffLocation
    ) {
      const coordinates = [
        [user!.currentLocation.longitude, user!.currentLocation.latitude],
        [order.pickupLocation.longitude, order.pickupLocation.latitude],
        [order.dropoffLocation.longitude, order.dropoffLocation.latitude],
      ];
      getDistance(coordinates).then(({ duration, distance }) => {
        setDuration(duration);
        setDistance(distance);
      });
    }
  }, [user, order]);

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.textPrice}>
        {formatCurrencyFromCents(
          order.totalCompensation,
          order.currencyCode,
        )}
      </Text>
      {!hasDeadline && millisWaited !== null && (
        <Text style={styles.textWaiting} testID="offer-waiting">
          {waitingText(millisWaited, t)}
        </Text>
      )}
      <View style={styles.separator} />
      <View style={styles.content}>
        <View style={styles.containerLeft}>
          <Image source={Images.RestaurantGray} />
          <View style={styles.verticalLine} />
          <Image source={Images.HouseGray} />
        </View>
        <View style={styles.containerRight}>
          <View style={styles.containerAddressButton}>
            <View style={styles.containerText}>
              <Text style={styles.textName}>
                {order.pickupLocationFormattedAddress ??
                  order.pickupLocation?.formattedAddress ??
                  order.pickupName ??
                  'N/A'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => onCopyRestaurant(order)}>
              <View style={styles.containerChats}>
                <Image source={Images.Chats} />
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.containerMap}>
            {user && <Map order={order} user={user} />}
            <View style={styles.containerAway}>
              <View style={styles.containerTextAway}>
                <Image source={Images.Distance} />
                <Text style={styles.textDistance}>
                  {' '}
                  {`${metersToMiles(distance)} mi ${t('translations:away')}`}
                </Text>
              </View>
              <View style={styles.containerTextAway}>
                <Image source={Images.Clock} />
                <Text style={styles.textDistance}>{`${secondsToMinutes(
                  duration,
                )} min ${t('translations:away')}`}</Text>
              </View>
            </View>
          </View>
          <View style={styles.containerAddressButton}>
            <View style={styles.containerText}>
              <Text style={styles.textName}>
                {order.dropoffLocationFormattedAddress ??
                  order.dropoffLocation?.formattedAddress ??
                  order.dropoffName ??
                  'N/A'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => onCopyCustomer(order)}>
              <View style={styles.containerChats}>
                <Image source={Images.Chats} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <>
        <ButtonOrder
          millisRemaining={millisRemaining}
          totalMillis={totalMillis}
          style={styles.buttonTop}
          type={ButtonOrderType.accept}
          onPress={() => onAccept(order)}
          autoAcceptOrders={autoAcceptOrders}
        />
        <ButtonOrder
          type={ButtonOrderType.decline}
          onPress={() => onDecline(order)}
          autoAcceptOrders={autoAcceptOrders}
        />
      </>
      {!autoAcceptOrders && hasDeadline && (
        <View style={[styles.containerLoader, { height: PARALELOGRAM_HEIGHT }]}>
          {[...Array(numberOfParalelograms).keys()]
            .map(i => i)
            .map(index => {
              return (
                <Paralelogram
                  backgroundColor={paralelogramColor(index)}
                  width={PARALELOGRAM_WIDTH}
                  height={PARALELOGRAM_HEIGHT}
                />
              );
            })}
          <Animated.View style={[styles.progress, { width: widthAnimation }]} />
        </View>
      )}
    </View>
  );
};

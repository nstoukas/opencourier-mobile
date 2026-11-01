import React from 'react';
import { TouchableOpacity } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { InProgressCell } from './InProgressCell';
import { InProgressCellHeader } from '../InProgressCellHeader/InProgressCellHeader';
import { InProgressAdress } from '../InProgressAddress/InProgressAddress';
import { Icon } from '@app/components/Icon/Icon';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { HouseLineIcon } from 'phosphor-react-native/src/icons/HouseLine';
import { PhoneOutgoingIcon } from 'phosphor-react-native/src/icons/PhoneOutgoing';
import { OrderStatus } from '@app/types/enums';
import { Order } from '@app/types/types';
import '@app/localization/i18n';

jest.mock('../Map/Map', () => {
  const { View } = require('react-native');
  return () => <View testID="mock-map" />;
});

jest.mock('@app/hooks/useUser', () => () => ({
  user: {
    id: 'courier-1',
  },
}));

jest.mock('@app/hooks/useOrder', () => () => ({
  confirmOrderItems: jest.fn(),
  arrivedAtPickup: jest.fn(),
  isArrivedAtPickupPending: false,
  arrivedAtDropoff: jest.fn(),
  isArrivedAtDropoffPending: false,
}));

jest.mock('@app/hooks/useComment', () => () => ({
  createComment: jest.fn(),
  updateComment: jest.fn(),
  deleteComment: jest.fn(),
  addReaction: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

describe('InProgressCell (spec 0007, decision 65.10)', () => {
  const noopProps = {
    onCustomerAddressPress: jest.fn(),
    onRestaurantAddressPress: jest.fn(),
    onMessageRestaurant: jest.fn(),
    onCallRestaurant: jest.fn(),
    onMessageCustomer: jest.fn(),
    onCallCustomer: jest.fn(),
    onOrderItemsListForCustomer: jest.fn(),
    onReportIssue: jest.fn(),
  };

  const baseOrder: Partial<Order> = {
    id: 'order-123',
    dropoffName: 'Pizza Roma',
    dropoffBusinessName: 'Customer House',
    orderItems: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the drop off header as finished (renders CheckCircle in success tone) when order status is DROPPED_OFF', () => {
    const order = {
      ...baseOrder,
      status: OrderStatus.dropped_off,
    } as Order;

    const { UNSAFE_getAllByType } = render(
      <InProgressCell order={order} {...noopProps} />,
    );

    const headers = UNSAFE_getAllByType(InProgressCellHeader);
    const dropoffHeader = headers.find(h => h.props.icon === HouseLineIcon);
    expect(dropoffHeader).toBeDefined();
    expect(dropoffHeader!.props.finished).toBe(true);

    const icons = dropoffHeader!.findAllByType(Icon);
    const checkCircle = icons.find(i => i.props.icon === CheckCircleIcon);
    expect(checkCircle).toBeDefined();
    expect(checkCircle!.props.tone).toBe('success');

    const caretDown = icons.find(i => i.props.icon === CaretDownIcon);
    expect(caretDown).toBeUndefined();
  });

  it('does not show the drop off header as finished when order status is PICKED_UP', () => {
    const order = {
      ...baseOrder,
      status: OrderStatus.picked_up,
    } as Order;

    const { UNSAFE_getAllByType } = render(
      <InProgressCell order={order} {...noopProps} />,
    );

    const headers = UNSAFE_getAllByType(InProgressCellHeader);
    const dropoffHeader = headers.find(h => h.props.icon === HouseLineIcon);
    expect(dropoffHeader).toBeDefined();
    expect(dropoffHeader!.props.finished).toBe(false);

    const icons = dropoffHeader!.findAllByType(Icon);
    const checkCircle = icons.find(i => i.props.icon === CheckCircleIcon);
    expect(checkCircle).toBeUndefined();

    const caretDown = icons.find(i => i.props.icon === CaretDownIcon);
    expect(caretDown).toBeDefined();
  });

  describe('customer phone visibility (row 33, decision 33.1)', () => {
    it('with dropoffPhoneNumber: customer call button is present and calls onCallCustomer, and restaurant call button is also present', () => {
      const order = {
        ...baseOrder,
        status: OrderStatus.picked_up,
        dropoffPhoneNumber: '+306912345678',
      } as Order;

      const { UNSAFE_getAllByType } = render(
        <InProgressCell order={order} {...noopProps} />,
      );

      const addresses = UNSAFE_getAllByType(InProgressAdress);
      const restaurantAddress = addresses.find(
        a => a.props.customerOrRestaurant === 'restaurant',
      );
      const customerAddress = addresses.find(
        a => a.props.customerOrRestaurant === 'customer',
      );

      expect(restaurantAddress).toBeDefined();
      expect(customerAddress).toBeDefined();

      // Restaurant call button
      const restaurantPhoneIcon = restaurantAddress!
        .findAllByType(Icon)
        .find(i => i.props.icon === PhoneOutgoingIcon);
      expect(restaurantPhoneIcon).toBeDefined();

      const restaurantCallButton = restaurantAddress!
        .findAllByType(TouchableOpacity)
        .find(btn =>
          btn.findAllByType(Icon).some(i => i.props.icon === PhoneOutgoingIcon),
        );
      expect(restaurantCallButton).toBeDefined();
      fireEvent.press(restaurantCallButton!);
      expect(noopProps.onCallRestaurant).toHaveBeenCalledWith(order);

      // Customer call button is present and calls onCallCustomer
      const customerPhoneIcon = customerAddress!
        .findAllByType(Icon)
        .find(i => i.props.icon === PhoneOutgoingIcon);
      expect(customerPhoneIcon).toBeDefined();

      const customerCallButton = customerAddress!
        .findAllByType(TouchableOpacity)
        .find(btn =>
          btn.findAllByType(Icon).some(i => i.props.icon === PhoneOutgoingIcon),
        );
      expect(customerCallButton).toBeDefined();
      fireEvent.press(customerCallButton!);
      expect(noopProps.onCallCustomer).toHaveBeenCalledWith(order);
    });

    it('without dropoffPhoneNumber: no customer call button is rendered, while restaurant call button remains', () => {
      const order = {
        ...baseOrder,
        status: OrderStatus.picked_up,
        dropoffPhoneNumber: undefined,
      } as Order;

      const { UNSAFE_getAllByType } = render(
        <InProgressCell order={order} {...noopProps} />,
      );

      const addresses = UNSAFE_getAllByType(InProgressAdress);
      const restaurantAddress = addresses.find(
        a => a.props.customerOrRestaurant === 'restaurant',
      );
      const customerAddress = addresses.find(
        a => a.props.customerOrRestaurant === 'customer',
      );

      expect(restaurantAddress).toBeDefined();
      expect(customerAddress).toBeDefined();

      // Customer onCall prop is undefined and no call button is rendered
      expect(customerAddress!.props.onCall).toBeUndefined();
      const customerPhoneIcon = customerAddress!
        .findAllByType(Icon)
        .find(i => i.props.icon === PhoneOutgoingIcon);
      expect(customerPhoneIcon).toBeUndefined();

      // Restaurant call button is still present and functional
      const restaurantPhoneIcon = restaurantAddress!
        .findAllByType(Icon)
        .find(i => i.props.icon === PhoneOutgoingIcon);
      expect(restaurantPhoneIcon).toBeDefined();

      const restaurantCallButton = restaurantAddress!
        .findAllByType(TouchableOpacity)
        .find(btn =>
          btn.findAllByType(Icon).some(i => i.props.icon === PhoneOutgoingIcon),
        );
      expect(restaurantCallButton).toBeDefined();
      fireEvent.press(restaurantCallButton!);
      expect(noopProps.onCallRestaurant).toHaveBeenCalledWith(order);
    });

    it('with empty dropoffPhoneNumber: no customer call button is rendered, while restaurant call button remains', () => {
      const order = {
        ...baseOrder,
        status: OrderStatus.picked_up,
        dropoffPhoneNumber: '',
      } as Order;

      const { UNSAFE_getAllByType } = render(
        <InProgressCell order={order} {...noopProps} />,
      );

      const addresses = UNSAFE_getAllByType(InProgressAdress);
      const customerAddress = addresses.find(
        a => a.props.customerOrRestaurant === 'customer',
      );
      expect(customerAddress!.props.onCall).toBeUndefined();

      const customerPhoneIcon = customerAddress!
        .findAllByType(Icon)
        .find(i => i.props.icon === PhoneOutgoingIcon);
      expect(customerPhoneIcon).toBeUndefined();
    });
  });
});

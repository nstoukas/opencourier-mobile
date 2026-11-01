import React from 'react';
import { TouchableOpacity } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { InProgressCell } from './InProgressCell';
import { InProgressCellHeader } from '../InProgressCellHeader/InProgressCellHeader';
import { InProgressAdress } from '../InProgressAddress/InProgressAddress';
import { Icon } from '@app/components/Icon/Icon';
import { Button } from '@app/components/Button/Button';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { HouseLineIcon } from 'phosphor-react-native/src/icons/HouseLine';
import { PhoneOutgoingIcon } from 'phosphor-react-native/src/icons/PhoneOutgoing';
import { ChatTextIcon } from 'phosphor-react-native/src/icons/ChatText';
import { HeadsetIcon } from 'phosphor-react-native/src/icons/Headset';
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
    onTextCustomer: jest.fn(),
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

  describe('contact controls from the job (rows 33 & 72, decisions 33.1, 72.4, 72.5)', () => {
    it('with dropoffPhoneNumber, pickupPhoneNumber and status picked_up: customer call and restaurant call buttons are present and functional', () => {
      // While the delivery is held, both phone numbers are visible and callable (decision 72.5).
      const order = {
        ...baseOrder,
        status: OrderStatus.picked_up,
        pickupPhoneNumber: '+302421011111',
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

      // Restaurant call button is present and calls onCallRestaurant
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

    it('with dropoffPhoneNumber, pickupPhoneNumber and status dispatched: customer call and restaurant call buttons are present and functional', () => {
      // Dispatched delivery is held by rider: customer and restaurant call buttons are active.
      const order = {
        ...baseOrder,
        status: OrderStatus.dispatched,
        pickupPhoneNumber: '+302421011111',
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

    it('with dropoffPhoneNumber and status dropped_off: neither customer call nor restaurant call button is shown (decision 72.5)', () => {
      // Offline drop off: outbox shows status dropped_off while cached order retains phone numbers.
      // Under decision 72.5, no contact control outlives the job.
      const order = {
        ...baseOrder,
        status: OrderStatus.dropped_off,
        pickupPhoneNumber: '+302421011111',
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

      // Customer onCall prop is undefined and no customer call button is rendered
      expect(customerAddress!.props.onCall).toBeUndefined();
      const customerPhoneIcon = customerAddress!
        .findAllByType(Icon)
        .find(i => i.props.icon === PhoneOutgoingIcon);
      expect(customerPhoneIcon).toBeUndefined();

      // Restaurant onCall prop is undefined and no restaurant call button is rendered (decision 72.5)
      expect(restaurantAddress!.props.onCall).toBeUndefined();
      const restaurantPhoneIcon = restaurantAddress!
        .findAllByType(Icon)
        .find(i => i.props.icon === PhoneOutgoingIcon);
      expect(restaurantPhoneIcon).toBeUndefined();
    });

    it('with dropoffPhoneNumber and status canceled: neither customer call nor restaurant call button is shown (decision 72.5)', () => {
      // Canceled delivery: phone controls must disappear for both customer and restaurant.
      const order = {
        ...baseOrder,
        status: OrderStatus.canceled,
        pickupPhoneNumber: '+302421011111',
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

      // Customer onCall prop is undefined and no call button is rendered
      expect(customerAddress!.props.onCall).toBeUndefined();
      const customerPhoneIcon = customerAddress!
        .findAllByType(Icon)
        .find(i => i.props.icon === PhoneOutgoingIcon);
      expect(customerPhoneIcon).toBeUndefined();

      // Restaurant onCall prop is undefined and no restaurant call button is rendered (decision 72.5)
      expect(restaurantAddress!.props.onCall).toBeUndefined();
      const restaurantPhoneIcon = restaurantAddress!
        .findAllByType(Icon)
        .find(i => i.props.icon === PhoneOutgoingIcon);
      expect(restaurantPhoneIcon).toBeUndefined();
    });

    it('without dropoffPhoneNumber: no customer call button is rendered, while restaurant call button remains', () => {
      const order = {
        ...baseOrder,
        status: OrderStatus.picked_up,
        pickupPhoneNumber: '+302421011111',
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
        pickupPhoneNumber: '+302421011111',
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

      const restaurantAddress = addresses.find(
        a => a.props.customerOrRestaurant === 'restaurant',
      );
      expect(restaurantAddress!.props.onCall).toBeDefined();
    });

    it('without pickupPhoneNumber: no restaurant call button is rendered even while the job is active (decision 72.5)', () => {
      const order = {
        ...baseOrder,
        status: OrderStatus.picked_up,
        pickupPhoneNumber: undefined,
        dropoffPhoneNumber: '+306912345678',
      } as unknown as Order;

      const { UNSAFE_getAllByType } = render(
        <InProgressCell order={order} {...noopProps} />,
      );

      const addresses = UNSAFE_getAllByType(InProgressAdress);
      const restaurantAddress = addresses.find(
        a => a.props.customerOrRestaurant === 'restaurant',
      );
      expect(restaurantAddress!.props.onCall).toBeUndefined();

      const restaurantPhoneIcon = restaurantAddress!
        .findAllByType(Icon)
        .find(i => i.props.icon === PhoneOutgoingIcon);
      expect(restaurantPhoneIcon).toBeUndefined();
    });

    describe('customer text messages (row 72, decision 72.4)', () => {
      it('with dropoffPhoneNumber and active status: renders message button and calls onTextCustomer', () => {
        const order = {
          ...baseOrder,
          status: OrderStatus.picked_up,
          pickupPhoneNumber: '+302421011111',
          dropoffPhoneNumber: '+306912345678',
        } as Order;

        const { UNSAFE_getAllByType } = render(
          <InProgressCell order={order} {...noopProps} />,
        );

        const addresses = UNSAFE_getAllByType(InProgressAdress);
        const customerAddress = addresses.find(
          a => a.props.customerOrRestaurant === 'customer',
        );
        expect(customerAddress).toBeDefined();
        expect(customerAddress!.props.onText).toBeDefined();

        const messageIcon = customerAddress!
          .findAllByType(Icon)
          .find(i => i.props.icon === ChatTextIcon);
        expect(messageIcon).toBeDefined();

        const messageButton = customerAddress!
          .findAllByType(TouchableOpacity)
          .find(btn =>
            btn.findAllByType(Icon).some(i => i.props.icon === ChatTextIcon),
          );
        expect(messageButton).toBeDefined();

        fireEvent.press(messageButton!);
        expect(noopProps.onTextCustomer).toHaveBeenCalledTimes(1);
        expect(noopProps.onTextCustomer).toHaveBeenCalledWith(order);
      });

      it('without dropoffPhoneNumber: no customer message button is rendered', () => {
        const order = {
          ...baseOrder,
          status: OrderStatus.picked_up,
          pickupPhoneNumber: '+302421011111',
          dropoffPhoneNumber: undefined,
        } as unknown as Order;

        const { UNSAFE_getAllByType } = render(
          <InProgressCell order={order} {...noopProps} />,
        );

        const addresses = UNSAFE_getAllByType(InProgressAdress);
        const customerAddress = addresses.find(
          a => a.props.customerOrRestaurant === 'customer',
        );
        expect(customerAddress!.props.onText).toBeUndefined();

        const messageIcon = customerAddress!
          .findAllByType(Icon)
          .find(i => i.props.icon === ChatTextIcon);
        expect(messageIcon).toBeUndefined();
      });

      it('without onTextCustomer prop: no customer message button is rendered even with a phone number', () => {
        const order = {
          ...baseOrder,
          status: OrderStatus.picked_up,
          pickupPhoneNumber: '+302421011111',
          dropoffPhoneNumber: '+306912345678',
        } as Order;

        const { onTextCustomer: _, ...propsWithoutText } = noopProps;

        const { UNSAFE_getAllByType } = render(
          <InProgressCell order={order} {...propsWithoutText} />,
        );

        const addresses = UNSAFE_getAllByType(InProgressAdress);
        const customerAddress = addresses.find(
          a => a.props.customerOrRestaurant === 'customer',
        );
        expect(customerAddress!.props.onText).toBeUndefined();
      });

      it('when status is dropped_off or canceled: no customer message button is rendered', () => {
        for (const status of [OrderStatus.dropped_off, OrderStatus.canceled]) {
          const order = {
            ...baseOrder,
            status,
            pickupPhoneNumber: '+302421011111',
            dropoffPhoneNumber: '+306912345678',
          } as Order;

          const { UNSAFE_getAllByType } = render(
            <InProgressCell order={order} {...noopProps} />,
          );

          const addresses = UNSAFE_getAllByType(InProgressAdress);
          const customerAddress = addresses.find(
            a => a.props.customerOrRestaurant === 'customer',
          );
          expect(customerAddress!.props.onText).toBeUndefined();

          const messageIcon = customerAddress!
            .findAllByType(Icon)
            .find(i => i.props.icon === ChatTextIcon);
          expect(messageIcon).toBeUndefined();
        }
      });
    });

    describe('Call dispatch button (row 72, decisions 72.5, 72.7)', () => {
      it('shows Call dispatch button when onCallDispatch is provided and the job is active, and pressing it calls onCallDispatch', () => {
        const onCallDispatch = jest.fn();
        const order = {
          ...baseOrder,
          status: OrderStatus.picked_up,
          pickupPhoneNumber: '+302421011111',
          dropoffPhoneNumber: '+306912345678',
        } as Order;

        const component = render(
          <InProgressCell
            order={order}
            {...noopProps}
            onCallDispatch={onCallDispatch}
          />,
        );

        const buttons = component.UNSAFE_getAllByType(Button);
        const dispatchButton = buttons.find(b => b.props.icon === HeadsetIcon);
        expect(dispatchButton).toBeDefined();
        expect(dispatchButton!.props.title).toBe('Call dispatch');

        fireEvent.press(dispatchButton!);
        expect(onCallDispatch).toHaveBeenCalledTimes(1);
      });

      it('does NOT show Call dispatch button when onCallDispatch is omitted or undefined even if job is active', () => {
        const order = {
          ...baseOrder,
          status: OrderStatus.picked_up,
          pickupPhoneNumber: '+302421011111',
          dropoffPhoneNumber: '+306912345678',
        } as Order;

        const component = render(
          <InProgressCell
            order={order}
            {...noopProps}
            onCallDispatch={undefined}
          />,
        );

        const buttons = component.UNSAFE_queryAllByType(Button);
        const dispatchButton = buttons.find(b => b.props.icon === HeadsetIcon);
        expect(dispatchButton).toBeUndefined();
      });

      it('does NOT show Call dispatch button when the job is dropped_off or canceled even if onCallDispatch is provided', () => {
        const onCallDispatch = jest.fn();

        for (const status of [OrderStatus.dropped_off, OrderStatus.canceled]) {
          const order = {
            ...baseOrder,
            status,
            pickupPhoneNumber: '+302421011111',
            dropoffPhoneNumber: '+306912345678',
          } as Order;

          const component = render(
            <InProgressCell
              order={order}
              {...noopProps}
              onCallDispatch={onCallDispatch}
            />,
          );

          const buttons = component.UNSAFE_queryAllByType(Button);
          const dispatchButton = buttons.find(b => b.props.icon === HeadsetIcon);
          expect(dispatchButton).toBeUndefined();
        }
      });
    });

    describe('All contact controls disappear when job is over (decision 72.5)', () => {
      it('renders none of: customer call, customer message, restaurant call, Call dispatch when dropped_off or canceled', () => {
        const onCallDispatch = jest.fn();

        for (const status of [OrderStatus.dropped_off, OrderStatus.canceled]) {
          const order = {
            ...baseOrder,
            status,
            pickupPhoneNumber: '+302421011111',
            dropoffPhoneNumber: '+306912345678',
          } as Order;

          const component = render(
            <InProgressCell
              order={order}
              {...noopProps}
              onCallDispatch={onCallDispatch}
            />,
          );

          const addresses = component.UNSAFE_getAllByType(InProgressAdress);
          const restaurantAddress = addresses.find(
            a => a.props.customerOrRestaurant === 'restaurant',
          )!;
          const customerAddress = addresses.find(
            a => a.props.customerOrRestaurant === 'customer',
          )!;

          // No restaurant call
          expect(restaurantAddress.props.onCall).toBeUndefined();
          expect(
            restaurantAddress
              .findAllByType(Icon)
              .find(i => i.props.icon === PhoneOutgoingIcon),
          ).toBeUndefined();

          // No customer call
          expect(customerAddress.props.onCall).toBeUndefined();
          expect(
            customerAddress
              .findAllByType(Icon)
              .find(i => i.props.icon === PhoneOutgoingIcon),
          ).toBeUndefined();

          // No customer message
          expect(customerAddress.props.onText).toBeUndefined();
          expect(
            customerAddress
              .findAllByType(Icon)
              .find(i => i.props.icon === ChatTextIcon),
          ).toBeUndefined();

          // No call dispatch
          const buttons = component.UNSAFE_queryAllByType(Button);
          expect(
            buttons.find(b => b.props.icon === HeadsetIcon),
          ).toBeUndefined();
        }
      });
    });
  });
});

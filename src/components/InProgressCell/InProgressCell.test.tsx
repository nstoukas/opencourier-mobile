import React from 'react';
import { TouchableOpacity } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { InProgressCell, canMoveDropoffPin } from './InProgressCell';
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
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { OrderStatus } from '@app/types/enums';
import { Order } from '@app/types/types';
import i18n from '@app/localization/i18n';

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

        // No handler for texting (undefined is what an absent prop reads as).
        const propsWithoutText = { ...noopProps, onTextCustomer: undefined };

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
          const dispatchButton = buttons.find(
            b => b.props.icon === HeadsetIcon,
          );
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

    describe('Address pin, floor and doorbell (spec 0016, AC-7, AC-8)', () => {
      describe('canMoveDropoffPin helper', () => {
        it('returns true only when status is arrived at dropoff and dropoffPointCorrectedAt is empty', () => {
          expect(
            canMoveDropoffPin({
              status: OrderStatus.courier_arrived_at_dropoff_location,
              dropoffPointCorrectedAt: null,
            } as Order),
          ).toBe(true);

          expect(
            canMoveDropoffPin({
              status: OrderStatus.courier_arrived_at_dropoff_location,
              dropoffPointCorrectedAt: undefined,
            } as Order),
          ).toBe(true);
        });

        it('returns false when status is not arrived at dropoff', () => {
          const statuses = [
            OrderStatus.dispatched,
            OrderStatus.courier_arrived_at_pickup_location,
            OrderStatus.picked_up,
            OrderStatus.on_the_way,
            OrderStatus.dropped_off,
            OrderStatus.canceled,
          ];
          for (const status of statuses) {
            expect(
              canMoveDropoffPin({
                status,
                dropoffPointCorrectedAt: null,
              } as Order),
            ).toBe(false);
          }
        });

        it('returns false when dropoffPointCorrectedAt is set', () => {
          expect(
            canMoveDropoffPin({
              status: OrderStatus.courier_arrived_at_dropoff_location,
              dropoffPointCorrectedAt: '2026-11-02T03:00:00.000Z',
            } as Order),
          ).toBe(false);
        });
      });

      describe('Floor and Doorbell lines (AC-7)', () => {
        it('renders "Floor 3" and "Doorbell Papadopoulou" when present', () => {
          const order = {
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_dropoff_location,
            dropoffFloor: '3',
            dropoffDoorbell: 'Papadopoulou',
          } as Order;

          const component = render(
            <InProgressCell order={order} {...noopProps} />,
          );

          expect(component.getByText('Floor 3')).toBeDefined();
          expect(component.getByText('Doorbell Papadopoulou')).toBeDefined();
        });

        it('renders Floor when Doorbell is missing or empty, and vice versa', () => {
          const orderOnlyFloor = {
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_dropoff_location,
            dropoffFloor: '4B',
            dropoffDoorbell: '',
          } as Order;

          const component1 = render(
            <InProgressCell order={orderOnlyFloor} {...noopProps} />,
          );
          expect(component1.getByText('Floor 4B')).toBeDefined();
          expect(component1.queryByText(/Doorbell/)).toBeNull();

          const orderOnlyDoorbell = {
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_dropoff_location,
            dropoffFloor: null,
            dropoffDoorbell: 'K.',
          } as Order;

          const component2 = render(
            <InProgressCell order={orderOnlyDoorbell} {...noopProps} />,
          );
          expect(component2.queryByText(/Floor/)).toBeNull();
          expect(component2.getByText('Doorbell K.')).toBeDefined();
        });

        it('leaves out both Floor and Doorbell when empty or missing', () => {
          const orderEmpty = {
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_dropoff_location,
            dropoffFloor: '',
            dropoffDoorbell: '',
          } as Order;

          const component = render(
            <InProgressCell order={orderEmpty} {...noopProps} />,
          );
          expect(component.queryByText(/Floor/)).toBeNull();
          expect(component.queryByText(/Doorbell/)).toBeNull();

          const orderMissing = {
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_dropoff_location,
            dropoffFloor: undefined,
            dropoffDoorbell: null,
          } as Order;

          const componentMissing = render(
            <InProgressCell order={orderMissing} {...noopProps} />,
          );
          expect(componentMissing.queryByText(/Floor/)).toBeNull();
          expect(componentMissing.queryByText(/Doorbell/)).toBeNull();
        });
      });

      describe('"Pin wrong? Set it where I stand" button (AC-8)', () => {
        it('shows button when status is arrived at dropoff, dropoffPointCorrectedAt is empty, and onMovePin is given', () => {
          const onMovePin = jest.fn();
          const order = {
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_dropoff_location,
            dropoffPointCorrectedAt: null,
          } as Order;

          const component = render(
            <InProgressCell
              order={order}
              {...noopProps}
              onMovePin={onMovePin}
            />,
          );

          const buttons = component.UNSAFE_queryAllByType(Button);
          const pinButton = buttons.find(b => b.props.icon === MapPinIcon);
          expect(pinButton).toBeDefined();
          expect(pinButton!.props.title).toBe(
            'Pin wrong? Set it where I stand',
          );
        });

        it('hides button in PICKED_UP, ON_THE_WAY, DROPPED_OFF and DISPATCHED', () => {
          const onMovePin = jest.fn();
          const statuses = [
            OrderStatus.picked_up,
            OrderStatus.on_the_way,
            OrderStatus.dropped_off,
            OrderStatus.dispatched,
            OrderStatus.courier_arrived_at_pickup_location,
          ];

          for (const status of statuses) {
            const order = {
              ...baseOrder,
              status,
              dropoffPointCorrectedAt: null,
            } as Order;

            const component = render(
              <InProgressCell
                order={order}
                {...noopProps}
                onMovePin={onMovePin}
              />,
            );

            const buttons = component.UNSAFE_queryAllByType(Button);
            expect(
              buttons.find(b => b.props.icon === MapPinIcon),
            ).toBeUndefined();
          }
        });

        it('hides button once dropoffPointCorrectedAt is set', () => {
          const onMovePin = jest.fn();
          const order = {
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_dropoff_location,
            dropoffPointCorrectedAt: '2026-11-02T03:30:00.000Z',
          } as Order;

          const component = render(
            <InProgressCell
              order={order}
              {...noopProps}
              onMovePin={onMovePin}
            />,
          );

          const buttons = component.UNSAFE_queryAllByType(Button);
          expect(
            buttons.find(b => b.props.icon === MapPinIcon),
          ).toBeUndefined();
        });

        it('hides button when onMovePin is omitted', () => {
          const order = {
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_dropoff_location,
            dropoffPointCorrectedAt: null,
          } as Order;

          const component = render(
            <InProgressCell
              order={order}
              {...noopProps}
              onMovePin={undefined}
            />,
          );

          const buttons = component.UNSAFE_queryAllByType(Button);
          expect(
            buttons.find(b => b.props.icon === MapPinIcon),
          ).toBeUndefined();
        });

        it('calls onMovePin with the order when tapped', () => {
          const onMovePin = jest.fn();
          const order = {
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_dropoff_location,
            dropoffPointCorrectedAt: null,
          } as Order;

          const component = render(
            <InProgressCell
              order={order}
              {...noopProps}
              onMovePin={onMovePin}
            />,
          );

          const pinButton = component.getByText(
            'Pin wrong? Set it where I stand',
          );
          fireEvent.press(pinButton);

          expect(onMovePin).toHaveBeenCalledTimes(1);
          expect(onMovePin).toHaveBeenCalledWith(order);
        });

        it('disables button and shows spinner when movingPin is true', () => {
          const onMovePin = jest.fn();
          const order = {
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_dropoff_location,
            dropoffPointCorrectedAt: null,
          } as Order;

          const component = render(
            <InProgressCell
              order={order}
              {...noopProps}
              onMovePin={onMovePin}
              movingPin={true}
            />,
          );

          const buttons = component.UNSAFE_queryAllByType(Button);
          const pinButton = buttons.find(b => b.props.icon === MapPinIcon)!;
          expect(pinButton).toBeDefined();
          expect(pinButton.props.disabled).toBe(true);
          expect(pinButton.props.isLoading).toBe(true);
        });
      });

      describe('Navigate button and RouteLines (spec 0018, AC-7, AC-12)', () => {
        it('shows Navigate button when onNavigate is provided and job is active, and pressing it calls onNavigate', () => {
          const onNavigateMock = jest.fn();
          const order = {
            ...baseOrder,
            status: OrderStatus.picked_up,
          } as Order;

          const { getByText } = render(
            <InProgressCell
              order={order}
              {...noopProps}
              onNavigate={onNavigateMock}
            />,
          );

          const navButton = getByText(i18n.t('translations:navigate'));
          fireEvent.press(navButton);
          expect(onNavigateMock).toHaveBeenCalledWith(order);
        });

        it('hides Navigate button when job is over (dropped_off or canceled)', () => {
          for (const status of [
            OrderStatus.dropped_off,
            OrderStatus.canceled,
          ]) {
            const { queryByText, unmount } = render(
              <InProgressCell
                order={{ ...baseOrder, status } as Order}
                {...noopProps}
                onNavigate={jest.fn()}
              />,
            );

            expect(queryByText(i18n.t('translations:navigate'))).toBeNull();
            unmount();
          }
        });

        it('renders RouteLines with distance and duration lines', () => {
          const { getByText } = render(
            <InProgressCell
              order={baseOrder as Order}
              {...noopProps}
              toRestaurant={{ km: '1.2', minutes: 4 }}
              toCustomer={{ km: '2.9', minutes: 5 }}
            />,
          );

          expect(
            getByText(
              i18n.t('translations:route_to_restaurant', {
                km: '1.2',
                minutes: 4,
              }),
            ),
          ).toBeTruthy();
          expect(
            getByText(
              i18n.t('translations:route_to_customer', {
                km: '2.9',
                minutes: 5,
              }),
            ),
          ).toBeTruthy();
        });
      });

      describe('Hand back button & customer details privacy (spec 0020, AC-4, AC-9, decisions 71.10, 71.12)', () => {
        beforeEach(() => {
          jest.useFakeTimers();
        });

        afterEach(() => {
          jest.useRealTimers();
        });

        it('shows "Hand back · N s" only when canHandBack holds and disappears at 0 (fake timers)', () => {
          const now = 500_000;
          jest.setSystemTime(now);

          const onHandBack = jest.fn();
          const order = {
            ...baseOrder,
            status: OrderStatus.accepted,
            handBackUntilOnPhone: now + 42_000,
            waitingToSend: false,
          } as Order;

          const component = render(
            <InProgressCell
              order={order}
              {...noopProps}
              onHandBack={onHandBack}
            />,
          );

          // Shows initial seconds
          const button = component.getByText('Hand back · 42 s');
          expect(button).toBeTruthy();

          // Pressing it calls onHandBack
          fireEvent.press(button);
          expect(onHandBack).toHaveBeenCalledWith(order);

          // Advance timers 2 seconds
          act(() => {
            jest.advanceTimersByTime(2000);
          });
          expect(component.getByText('Hand back · 40 s')).toBeTruthy();

          // Advance past window end -> button disappears
          act(() => {
            jest.advanceTimersByTime(40_000);
          });
          expect(component.queryByText(/Hand back/i)).toBeNull();
        });

        it('with a waiting outbox step for the delivery the button is absent', () => {
          const now = 500_000;
          jest.setSystemTime(now);

          const order = {
            ...baseOrder,
            status: OrderStatus.accepted,
            handBackUntilOnPhone: now + 30_000,
            waitingToSend: true, // Outbox step waiting
          } as Order;

          const component = render(
            <InProgressCell
              order={order}
              {...noopProps}
              onHandBack={jest.fn()}
            />,
          );

          expect(component.queryByText(/Hand back/i)).toBeNull();
        });

        it('button is absent when status is COURIER_ARRIVED_AT_PICKUP_LOCATION even inside the window', () => {
          const now = 500_000;
          jest.setSystemTime(now);

          const order = {
            ...baseOrder,
            status: OrderStatus.courier_arrived_at_pickup_location,
            handBackUntilOnPhone: now + 30_000,
            waitingToSend: false,
          } as Order;

          const component = render(
            <InProgressCell
              order={order}
              {...noopProps}
              onHandBack={jest.fn()}
            />,
          );

          expect(component.queryByText(/Hand back/i)).toBeNull();
        });

        it('during the window customer details, floor, doorbell, notes and copy button are not rendered and area is; after the window they are', () => {
          const now = 600_000;
          jest.setSystemTime(now);

          const order = {
            ...baseOrder,
            status: OrderStatus.accepted,
            handBackUntilOnPhone: now + 20_000,
            waitingToSend: false,
            dropoffName: 'Nikos Papadopoulos',
            dropoffBusinessName: 'Papadopoulos Residence',
            pickupBusinessName: 'Taverna Olympos',
            dropoffLocation: {
              street: 'Iasonos',
              houseNumber: '42',
              city: 'Volos',
            },
            dropoffAddress: 'Iasonos 42, Volos',
            dropoffFloor: '3',
            dropoffDoorbell: 'Papadopoulos',
            dropoffPhoneNumber: '+306912345678',
            dropoffSellerNotes: 'Secret customer note',
            dropOffLocationNotes: [
              {
                id: 'loc-1',
                note: 'Secret location note',
                upvotes: 0,
                downvotes: 0,
              } as any,
            ],
          } as unknown as Order;

          const component = render(
            <InProgressCell
              order={order}
              {...noopProps}
              onHandBack={jest.fn()}
            />,
          );

          // DURING WINDOW:
          // Top header shows restaurant name, NOT customer name
          expect(component.getByText('Taverna Olympos')).toBeTruthy();
          expect(component.queryByText('Nikos Papadopoulos')).toBeNull();

          // Bottom header and NextStep show area 'Iasonos', NOT 'Papadopoulos Residence'
          expect(component.getAllByText('Iasonos').length).toBe(2);
          expect(component.queryByText('Papadopoulos Residence')).toBeNull();

          // Customer details are NOT rendered
          expect(component.queryByText('Iasonos 42, Volos')).toBeNull();
          expect(component.queryByText(/Floor/i)).toBeNull();
          expect(component.queryByText(/Doorbell/i)).toBeNull();
          expect(component.queryByText('Secret customer note')).toBeNull();
          expect(component.queryByText('Secret location note')).toBeNull();

          // AFTER WINDOW (advance 21s):
          act(() => {
            jest.advanceTimersByTime(21_000);
          });

          // Top header and NextStep show customer name
          expect(component.getAllByText('Nikos Papadopoulos').length).toBe(2);

          // Bottom header shows customer business name
          expect(component.getByText('Papadopoulos Residence')).toBeTruthy();

          // Floor and doorbell are rendered
          expect(
            component.getByText(
              i18n.t('translations:dropoff_floor', { floor: '3' }),
            ),
          ).toBeTruthy();
          expect(
            component.getByText(
              i18n.t('translations:dropoff_doorbell', {
                doorbell: 'Papadopoulos',
              }),
            ),
          ).toBeTruthy();

          // Notes are rendered
          expect(component.getByText('Secret customer note')).toBeTruthy();
          expect(component.getByText('Secret location note')).toBeTruthy();
        });
      });
    });
  });
});

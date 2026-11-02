import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { OrderStatus } from '@app/types/enums';
import { Order } from '@app/types/types';
import { clearPickedUpTimes, setPickedUpAt } from '@app/services/pickupTimes';
import { InProgressCell, canMoveDropoffPin } from './InProgressCell';

describe('InProgressCell (spec 0021, AC-6 to AC-8, AC-14, spec 0016)', () => {
  const baseOrder: Order = {
    id: 'c3924f7e-98b3-4f9e-a89a-0123456789ab',
    status: OrderStatus.dispatched,
    pickupBusinessName: 'Souvlaki Bar',
    pickupLocationFormattedAddress: 'Iasonos 12, Volos',
    pickupPhoneNumber: '+302421011111',
    dropoffName: 'Maria Papadopoulou',
    dropoffLocationFormattedAddress: 'Dimitriadis 45, Volos',
    dropoffPhoneNumber: '+306912345678',
    dropoffFloor: '3',
    dropoffDoorbell: 'Papadopoulou',
    orderItems: [{ name: 'Pita Souvlaki', quantity: 2 }],
  } as unknown as Order;

  const noopProps = {
    onCallRestaurant: jest.fn(),
    onCallCustomer: jest.fn(),
    onTextCustomer: jest.fn(),
    onNavigate: jest.fn(),
    onMovePin: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearPickedUpTimes();
  });

  afterEach(() => {
    clearPickedUpTimes();
  });

  describe('canMoveDropoffPin helper (spec 0016)', () => {
    it('returns true only when status is courier_arrived_at_dropoff_location and pin has not been corrected', () => {
      const order = {
        ...baseOrder,
        status: OrderStatus.courier_arrived_at_dropoff_location,
        dropoffPointCorrectedAt: undefined,
      } as unknown as Order;

      expect(canMoveDropoffPin(order)).toBe(true);
    });

    it('returns false when dropoffPointCorrectedAt is already set', () => {
      const order = {
        ...baseOrder,
        status: OrderStatus.courier_arrived_at_dropoff_location,
        dropoffPointCorrectedAt: '2026-11-02T12:00:00Z',
      } as unknown as Order;

      expect(canMoveDropoffPin(order)).toBe(false);
    });

    it('returns false for any status other than courier_arrived_at_dropoff_location', () => {
      const statuses = [
        OrderStatus.accepted,
        OrderStatus.dispatched,
        OrderStatus.courier_arrived_at_pickup_location,
        OrderStatus.picked_up,
        OrderStatus.on_the_way,
        OrderStatus.dropped_off,
        OrderStatus.canceled,
      ];

      for (const status of statuses) {
        expect(
          canMoveDropoffPin({ ...baseOrder, status } as unknown as Order),
        ).toBe(false);
      }
    });
  });

  describe('Pickup stage (AC-6, AC-7)', () => {
    it('renders pickup hero with order code, first name, restaurant details, and icons', () => {
      const onCallRestaurant = jest.fn();
      const onNavigate = jest.fn();

      const { getByTestId, getByText } = render(
        <InProgressCell
          order={baseOrder}
          {...noopProps}
          onCallRestaurant={onCallRestaurant}
          onNavigate={onNavigate}
        />,
      );

      // Card stage
      expect(getByTestId('job-card-pickup')).toBeTruthy();

      // AC-7: Order code is '#'+last 6 of delivery id
      expect(getByTestId('job-order-code')).toBeTruthy();
      expect(getByTestId('job-order-code').props.children).toBe('#6789ab');

      // First name: 'for Maria'
      expect(getByTestId('job-first-name')).toBeTruthy();
      expect(getByTestId('job-first-name').props.children).toBe(
        i18n.t('translations:order_for', { name: 'Maria' }),
      );

      // Restaurant name and address
      expect(getByText(/Souvlaki Bar · Iasonos 12, Volos/)).toBeTruthy();

      // Call restaurant icon button
      const callButton = getByTestId('job-call-restaurant');
      expect(callButton).toBeTruthy();
      fireEvent.press(callButton);
      expect(onCallRestaurant).toHaveBeenCalledWith(baseOrder);

      // Navigate icon button
      const navButton = getByTestId('job-navigate');
      expect(navButton).toBeTruthy();
      fireEvent.press(navButton);
      expect(onNavigate).toHaveBeenCalledWith(baseOrder);

      // Items line
      expect(getByTestId('job-items-line')).toBeTruthy();
    });

    it('hides customer first name during the free hand back window (AC-7, decision 71.10)', () => {
      const orderInWindow = {
        ...baseOrder,
        status: OrderStatus.dispatched,
        handBackUntilOnPhone: Date.now() + 60_000,
      } as unknown as Order;

      const { queryByTestId, getByTestId } = render(
        <InProgressCell order={orderInWindow} {...noopProps} />,
      );

      expect(getByTestId('job-order-code')).toBeTruthy();
      expect(queryByTestId('job-first-name')).toBeNull();
    });

    it('hides call restaurant button when pickupPhoneNumber is absent', () => {
      const orderWithoutPhone = {
        ...baseOrder,
        pickupPhoneNumber: undefined,
      } as unknown as Order;

      const { queryByTestId } = render(
        <InProgressCell order={orderWithoutPhone} {...noopProps} />,
      );

      expect(queryByTestId('job-call-restaurant')).toBeNull();
    });
  });

  describe('Dropoff stage (AC-6, AC-8)', () => {
    const dropoffOrder: Order = {
      ...baseOrder,
      status: OrderStatus.picked_up,
      pickupReadyAt: '2026-11-02T12:41:00Z',
    } as unknown as Order;

    it('renders dropoff hero with customer full name, address, floor, doorbell, and icons', () => {
      const onCallCustomer = jest.fn();
      const onTextCustomer = jest.fn();
      const onNavigate = jest.fn();

      const swipeTime = new Date('2026-11-02T12:41:00Z').getTime();
      setPickedUpAt(dropoffOrder.id, swipeTime);

      const { getByTestId, getByText } = render(
        <InProgressCell
          order={dropoffOrder}
          {...noopProps}
          onCallCustomer={onCallCustomer}
          onTextCustomer={onTextCustomer}
          onNavigate={onNavigate}
        />,
      );

      expect(getByTestId('job-card-dropoff')).toBeTruthy();

      // AC-8: Full customer name
      expect(getByTestId('job-customer-name')).toBeTruthy();
      expect(getByText('Maria Papadopoulou')).toBeTruthy();

      // Address
      expect(getByText('Dimitriadis 45, Volos')).toBeTruthy();

      // Floor and doorbell
      expect(getByTestId('job-floor-bell')).toBeTruthy();

      // Call customer
      const callCustomerButton = getByTestId('job-call-customer');
      expect(callCustomerButton).toBeTruthy();
      fireEvent.press(callCustomerButton);
      expect(onCallCustomer).toHaveBeenCalledWith(dropoffOrder);

      // Text customer
      const textCustomerButton = getByTestId('job-text-customer');
      expect(textCustomerButton).toBeTruthy();
      fireEvent.press(textCustomerButton);
      expect(onTextCustomer).toHaveBeenCalledWith(dropoffOrder);

      // Navigate
      const navButton = getByTestId('job-navigate');
      expect(navButton).toBeTruthy();
      fireEvent.press(navButton);
      expect(onNavigate).toHaveBeenCalledWith(dropoffOrder);

      // Restaurant line with picked up swipe time
      const formattedSwipeTime = new Date(swipeTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const expectedText = i18n.t('translations:picked_up_at', {
        restaurant: 'Souvlaki Bar',
        time: formattedSwipeTime,
      });
      expect(getByTestId('job-restaurant-line')).toBeTruthy();
      expect(getByText(expectedText)).toBeTruthy();
    });

    it('shows the swipe time from pickupTimes, never pickupReadyAt (which may be hours ago)', () => {
      // pickupReadyAt is 3 hours ago: 09:41
      const threeHoursAgo = new Date('2026-11-02T09:41:00Z').toISOString();
      const swipeTime = new Date('2026-11-02T12:41:00Z').getTime();

      const orderWithStaleReadyAt: Order = {
        ...dropoffOrder,
        pickupReadyAt: threeHoursAgo,
      } as unknown as Order;

      setPickedUpAt(orderWithStaleReadyAt.id, swipeTime);

      const formattedSwipeTime = new Date(swipeTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const formattedReadyAt = new Date(threeHoursAgo).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const { getByTestId, getByText, queryByText } = render(
        <InProgressCell order={orderWithStaleReadyAt} {...noopProps} />,
      );

      const expectedText = i18n.t('translations:picked_up_at', {
        restaurant: 'Souvlaki Bar',
        time: formattedSwipeTime,
      });

      expect(getByTestId('job-restaurant-line')).toBeTruthy();
      expect(getByText(expectedText)).toBeTruthy();
      expect(queryByText(new RegExp(formattedReadyAt))).toBeNull();
    });

    it('with pickupReadyAt set and no recorded swipe time (e.g. after restart), shows restaurant name only', () => {
      // pickupReadyAt is set on the order
      const orderWithReadyAt: Order = {
        ...dropoffOrder,
        pickupReadyAt: '2026-11-02T12:41:00Z',
      } as unknown as Order;

      // No recorded time in pickupTimes
      clearPickedUpTimes();

      const { getByTestId, getByText, queryByText } = render(
        <InProgressCell order={orderWithReadyAt} {...noopProps} />,
      );

      expect(getByTestId('job-restaurant-line')).toBeTruthy();
      expect(getByText('Souvlaki Bar')).toBeTruthy();
      expect(queryByText(/picked up/i)).toBeNull();
    });

    it('renders "Pin wrong? Set it where I stand" button when at dropoff and not corrected', () => {
      const onMovePin = jest.fn();
      const arrivedDropoffOrder = {
        ...dropoffOrder,
        status: OrderStatus.courier_arrived_at_dropoff_location,
        dropoffPointCorrectedAt: undefined,
      } as unknown as Order;

      const { getByText } = render(
        <InProgressCell
          order={arrivedDropoffOrder}
          {...noopProps}
          onMovePin={onMovePin}
        />,
      );

      const pinButton = getByText(i18n.t('translations:pin_wrong_button'));
      expect(pinButton).toBeTruthy();

      fireEvent.press(pinButton);
      expect(onMovePin).toHaveBeenCalledWith(arrivedDropoffOrder);
    });

    it('hides customer contact buttons when dropoffPhoneNumber is missing', () => {
      const orderWithoutPhone = {
        ...dropoffOrder,
        dropoffPhoneNumber: undefined,
      } as unknown as Order;

      const { queryByTestId } = render(
        <InProgressCell order={orderWithoutPhone} {...noopProps} />,
      );

      expect(queryByTestId('job-call-customer')).toBeNull();
      expect(queryByTestId('job-text-customer')).toBeNull();
    });
  });

  describe('When job is over (decision 72.5)', () => {
    it('hides call and text buttons when status is dropped_off or canceled', () => {
      for (const status of [OrderStatus.dropped_off, OrderStatus.canceled]) {
        const finishedOrder = {
          ...baseOrder,
          status,
        } as unknown as Order;

        const { queryByTestId } = render(
          <InProgressCell order={finishedOrder} {...noopProps} />,
        );

        expect(queryByTestId('job-call-restaurant')).toBeNull();
        expect(queryByTestId('job-call-customer')).toBeNull();
        expect(queryByTestId('job-text-customer')).toBeNull();
        expect(queryByTestId('job-navigate')).toBeNull();
      }
    });
  });

  describe('Route unavailable message (spec 0018, AC-6)', () => {
    it('displays route not available message when routeUnavailable is true and no leg figures', () => {
      const { getByTestId } = render(
        <InProgressCell
          order={baseOrder}
          {...noopProps}
          routeUnavailable={true}
        />,
      );

      expect(getByTestId('route-unavailable')).toBeTruthy();
      expect(getByTestId('route-unavailable').props.children).toBe(
        i18n.t('translations:route_not_available'),
      );
    });

    it('does not display route not available when legs are present', () => {
      const { queryByTestId } = render(
        <InProgressCell
          order={baseOrder}
          {...noopProps}
          routeUnavailable={true}
          toRestaurant={{ km: '1.0', minutes: 3 }}
        />,
      );

      expect(queryByTestId('route-unavailable')).toBeNull();
    });
  });
});

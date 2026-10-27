import React from 'react';
import { render } from '@testing-library/react-native';
import { InProgressCell } from './InProgressCell';
import { InProgressCellHeader } from '../InProgressCellHeader/InProgressCellHeader';
import { Icon } from '@app/components/Icon/Icon';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { HouseLineIcon } from 'phosphor-react-native/src/icons/HouseLine';
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
});

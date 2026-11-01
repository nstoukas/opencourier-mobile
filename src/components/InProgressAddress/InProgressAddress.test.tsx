import React from 'react';
import { TouchableOpacity } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { InProgressAdress } from './InProgressAddress';
import { Icon } from '@app/components/Icon/Icon';
import { CopyIcon } from 'phosphor-react-native/src/icons/Copy';
import { PhoneOutgoingIcon } from 'phosphor-react-native/src/icons/PhoneOutgoing';
import { Order } from '@app/types/types';

describe('InProgressAddress (row 33, decision 33.1)', () => {
  const baseOrder: Partial<Order> = {
    id: 'order-123',
    dropoffLocationFormattedAddress: '42 Customer Street',
    pickupLocationFormattedAddress: '10 Restaurant Avenue',
    dropoffPhoneNumber: '+306912345678',
  };

  it('renders the call button when onCall is given and calls it with the order', () => {
    const onCall = jest.fn();
    const onCopyAddress = jest.fn();
    const onAddressPress = jest.fn();

    const { UNSAFE_getAllByType } = render(
      <InProgressAdress
        order={baseOrder as Order}
        customerOrRestaurant="customer"
        onAddressPress={onAddressPress}
        onCopyAddress={onCopyAddress}
        onCall={onCall}
        expanded={true}
      />,
    );

    const icons = UNSAFE_getAllByType(Icon);
    const phoneIcon = icons.find(i => i.props.icon === PhoneOutgoingIcon);
    expect(phoneIcon).toBeDefined();

    const buttons = UNSAFE_getAllByType(TouchableOpacity);
    const callButton = buttons.find(b =>
      b.findAllByType(Icon).some(i => i.props.icon === PhoneOutgoingIcon),
    );
    expect(callButton).toBeDefined();

    fireEvent.press(callButton!);
    expect(onCall).toHaveBeenCalledTimes(1);
    expect(onCall).toHaveBeenCalledWith(baseOrder);
  });

  it('renders no call button without onCall while the copy button stays and works', () => {
    const onCopyAddress = jest.fn();
    const onAddressPress = jest.fn();

    const { UNSAFE_getAllByType } = render(
      <InProgressAdress
        order={baseOrder as Order}
        customerOrRestaurant="customer"
        onAddressPress={onAddressPress}
        onCopyAddress={onCopyAddress}
        // onCall is omitted (undefined)
        expanded={true}
      />,
    );

    const icons = UNSAFE_getAllByType(Icon);
    const phoneIcon = icons.find(i => i.props.icon === PhoneOutgoingIcon);
    expect(phoneIcon).toBeUndefined();

    const copyIcon = icons.find(i => i.props.icon === CopyIcon);
    expect(copyIcon).toBeDefined();

    const buttons = UNSAFE_getAllByType(TouchableOpacity);
    expect(buttons).toHaveLength(1);

    fireEvent.press(buttons[0]);
    expect(onCopyAddress).toHaveBeenCalledTimes(1);
    expect(onCopyAddress).toHaveBeenCalledWith(baseOrder);
  });

  it('renders no call button when onCall is explicitly undefined', () => {
    const onCopyAddress = jest.fn();
    const onAddressPress = jest.fn();

    const { UNSAFE_getAllByType } = render(
      <InProgressAdress
        order={baseOrder as Order}
        customerOrRestaurant="customer"
        onAddressPress={onAddressPress}
        onCopyAddress={onCopyAddress}
        onCall={undefined}
        expanded={true}
      />,
    );

    const icons = UNSAFE_getAllByType(Icon);
    const phoneIcon = icons.find(i => i.props.icon === PhoneOutgoingIcon);
    expect(phoneIcon).toBeUndefined();

    const copyIcon = icons.find(i => i.props.icon === CopyIcon);
    expect(copyIcon).toBeDefined();

    const buttons = UNSAFE_getAllByType(TouchableOpacity);
    expect(buttons).toHaveLength(1);
  });
});

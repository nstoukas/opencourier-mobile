import React from 'react';
import { TouchableOpacity } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { InProgressAdress } from './InProgressAddress';
import { Icon } from '@app/components/Icon/Icon';
import { CopyIcon } from 'phosphor-react-native/src/icons/Copy';
import { PhoneOutgoingIcon } from 'phosphor-react-native/src/icons/PhoneOutgoing';
import { ChatTextIcon } from 'phosphor-react-native/src/icons/ChatText';
import { Order } from '@app/types/types';
import '@app/localization/i18n';

describe('InProgressAddress (rows 33 & 72, decisions 33.1, 72.4, 72.5)', () => {
  const baseOrder: Partial<Order> = {
    id: 'order-123',
    dropoffLocationFormattedAddress: '42 Customer Street',
    pickupLocationFormattedAddress: '10 Restaurant Avenue',
    dropoffPhoneNumber: '+306912345678',
  };

  it('renders the call button when onCall is given and calls it with the order, with accessible label', () => {
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
    expect(callButton!.props.accessibilityRole).toBe('button');
    expect(callButton!.props.accessibilityLabel).toBe('Call the customer');

    fireEvent.press(callButton!);
    expect(onCall).toHaveBeenCalledTimes(1);
    expect(onCall).toHaveBeenCalledWith(baseOrder);
  });

  it('renders call button with restaurant label when customerOrRestaurant is restaurant', () => {
    const onCall = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <InProgressAdress
        order={baseOrder as Order}
        customerOrRestaurant="restaurant"
        onAddressPress={jest.fn()}
        onCopyAddress={jest.fn()}
        onCall={onCall}
        expanded={true}
      />,
    );

    const buttons = UNSAFE_getAllByType(TouchableOpacity);
    const callButton = buttons.find(b =>
      b.findAllByType(Icon).some(i => i.props.icon === PhoneOutgoingIcon),
    );
    expect(callButton).toBeDefined();
    expect(callButton!.props.accessibilityLabel).toBe('Call the restaurant');
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

  describe('message button (row 72, decision 72.4)', () => {
    it('renders the message button when onText is given and calls it with the order', () => {
      const onText = jest.fn();
      const { UNSAFE_getAllByType } = render(
        <InProgressAdress
          order={baseOrder as Order}
          customerOrRestaurant="customer"
          onAddressPress={jest.fn()}
          onCopyAddress={jest.fn()}
          onText={onText}
          expanded={true}
        />,
      );

      const icons = UNSAFE_getAllByType(Icon);
      const textIcon = icons.find(i => i.props.icon === ChatTextIcon);
      expect(textIcon).toBeDefined();

      const buttons = UNSAFE_getAllByType(TouchableOpacity);
      const textButton = buttons.find(b =>
        b.findAllByType(Icon).some(i => i.props.icon === ChatTextIcon),
      );
      expect(textButton).toBeDefined();
      expect(textButton!.props.accessibilityRole).toBe('button');
      expect(textButton!.props.accessibilityLabel).toBe('Text the customer');

      fireEvent.press(textButton!);
      expect(onText).toHaveBeenCalledTimes(1);
      expect(onText).toHaveBeenCalledWith(baseOrder);
    });

    it('renders no message button when onText is omitted or undefined', () => {
      const { UNSAFE_getAllByType } = render(
        <InProgressAdress
          order={baseOrder as Order}
          customerOrRestaurant="customer"
          onAddressPress={jest.fn()}
          onCopyAddress={jest.fn()}
          expanded={true}
        />,
      );

      const icons = UNSAFE_getAllByType(Icon);
      const textIcon = icons.find(i => i.props.icon === ChatTextIcon);
      expect(textIcon).toBeUndefined();
    });
  });
});

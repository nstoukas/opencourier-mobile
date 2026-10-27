import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { render } from '@testing-library/react-native';
import { ButtonOrder, ButtonOrderType } from './ButtonOrder';
import { control } from '@app/styles/theme';
import '@app/localization/i18n';

describe('AC-5: ButtonOrder heights and variants', () => {
  it('renders accept button 100 tall (control.offer)', () => {
    const { UNSAFE_getByType } = render(
      <ButtonOrder
        type={ButtonOrderType.accept}
        onPress={() => {}}
        autoAcceptOrders={false}
      />,
    );
    const touchable = UNSAFE_getByType(TouchableOpacity);
    const flatStyle = StyleSheet.flatten(touchable.props.style);
    expect(flatStyle.height).toBe(control.offer);
    expect(flatStyle.height).toBe(100);
  });

  it('renders decline button 100 tall (control.offer)', () => {
    const { UNSAFE_getByType } = render(
      <ButtonOrder
        type={ButtonOrderType.decline}
        onPress={() => {}}
        autoAcceptOrders={false}
      />,
    );
    const touchable = UNSAFE_getByType(TouchableOpacity);
    const flatStyle = StyleSheet.flatten(touchable.props.style);
    expect(flatStyle.height).toBe(control.offer);
    expect(flatStyle.height).toBe(100);
  });

  it('renders acceptNow button 56 tall', () => {
    const { UNSAFE_getByType } = render(
      <ButtonOrder
        type={ButtonOrderType.acceptNow}
        onPress={() => {}}
        autoAcceptOrders={false}
      />,
    );
    const touchable = UNSAFE_getByType(TouchableOpacity);
    const flatStyle = StyleSheet.flatten(touchable.props.style);
    expect(flatStyle.height).toBe(56);
  });

  it('renders declineNow button 56 tall', () => {
    const { UNSAFE_getByType } = render(
      <ButtonOrder
        type={ButtonOrderType.declineNow}
        onPress={() => {}}
        autoAcceptOrders={false}
      />,
    );
    const touchable = UNSAFE_getByType(TouchableOpacity);
    const flatStyle = StyleSheet.flatten(touchable.props.style);
    expect(flatStyle.height).toBe(56);
  });

  it('renders progress bar Paralelograms with React keys and logs no key warning (Row 66, Clause 6)', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ButtonOrder
        type={ButtonOrderType.accept}
        onPress={() => {}}
        autoAcceptOrders={true}
        millisRemaining={5000}
        totalMillis={10000}
      />,
    );

    const keyWarnings = errorSpy.mock.calls.filter(call =>
      call.some(
        arg => typeof arg === 'string' && arg.includes('unique "key" prop'),
      ),
    );
    expect(keyWarnings).toHaveLength(0);

    errorSpy.mockRestore();
  });
});

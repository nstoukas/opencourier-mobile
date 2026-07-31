import React from 'react';
import renderer from 'react-test-renderer';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { UserStatusSelector } from './UserStatusSelector';
import { UserStatus } from '@app/types/types';
import '@app/localization/i18n';

describe('UserStatusSelector', () => {
  it('does not log a unique key warning during rendering', () => {
    // Spy on console.error to detect React missing key warnings
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    renderer.create(
      <UserStatusSelector selected={UserStatus.Online} onPress={jest.fn()} />,
    );

    // Assert that no key warning was logged during rendering
    const keyWarningCall = consoleErrorSpy.mock.calls.find(
      call =>
        typeof call[0] === 'string' && call[0].includes('unique "key" prop'),
    );
    expect(keyWarningCall).toBeUndefined();

    consoleErrorSpy.mockRestore();
  });

  it('renders three status options with correct localized text', () => {
    const component = renderer.create(
      <UserStatusSelector selected={UserStatus.Online} onPress={jest.fn()} />,
    );

    // Extract text content from all rendered Text components
    const textNodes = component.root.findAllByType(Text);
    const renderedTexts = textNodes.map(node => node.props.children);

    expect(renderedTexts).toContain('Online');
    expect(renderedTexts).toContain('Last Call');
    expect(renderedTexts).toContain('Offline');
  });

  it('calls onPress with the corresponding UserStatus when an option is pressed', () => {
    const onPressMock = jest.fn();
    const component = renderer.create(
      <UserStatusSelector selected={UserStatus.Online} onPress={onPressMock} />,
    );

    // Locate TouchableOpacity for each status option (0: Online, 1: Last Call, 2: Offline)
    const touchables = component.root.findAllByType(TouchableOpacity);
    expect(touchables.length).toBe(3);

    // Invoke onPress for the third option (Offline)
    touchables[2].props.onPress();

    expect(onPressMock).toHaveBeenCalledTimes(1);
    expect(onPressMock).toHaveBeenCalledWith(UserStatus.Offline);
  });

  it('drives option background highlight based on selected status prop', () => {
    // Helper function to extract background color of the middle option (LastCall)
    const getMiddleOptionBackgroundColor = (selectedStatus: UserStatus) => {
      const component = renderer.create(
        <UserStatusSelector selected={selectedStatus} onPress={jest.fn()} />,
      );
      const tree = component.toJSON() as any;
      // tree.children[1] is the 2nd status item touchable (Last Call)
      // tree.children[1].children[0] is the inner View inside the touchable
      const innerView = tree.children[1].children[0];
      const flatStyle = StyleSheet.flatten(innerView.props.style);
      return flatStyle ? flatStyle.backgroundColor : undefined;
    };

    const bgWhenSelected = getMiddleOptionBackgroundColor(UserStatus.LastCall);
    const bgWhenNotSelected = getMiddleOptionBackgroundColor(
      UserStatus.Offline,
    );

    // Background color when selected ('#FAE48E') should differ from when not selected ('transparent')
    expect(bgWhenSelected).toBeDefined();
    expect(bgWhenNotSelected).toBeDefined();
    expect(bgWhenSelected).not.toEqual(bgWhenNotSelected);
  });
});

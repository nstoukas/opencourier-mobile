import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import {
  UserStatusSelector,
  statusButtonStyle,
  statusButtonColor,
  statusTextColor,
} from './UserStatusSelector';
import { styles } from './UserStatusSelector.styles';
import { UserStatus } from '@app/types/types';
import { Colors } from '@app/styles/colors';
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

  it('re-colours option background in place when selected prop updates', () => {
    // Mount UserStatusSelector with selected set to Online
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <UserStatusSelector selected={UserStatus.Online} onPress={jest.fn()} />,
      );
    });

    // Helper to read middle option (Last Call) background color
    const getMiddleOptionBgColor = () => {
      const tree = component.toJSON() as any;
      const innerView = tree.children[1].children[0];
      return StyleSheet.flatten(innerView.props.style)?.backgroundColor;
    };

    expect(getMiddleOptionBgColor()).toEqual(Colors.transparent);

    // Update selected prop to LastCall on the same mounted instance
    act(() => {
      component.update(
        <UserStatusSelector
          selected={UserStatus.LastCall}
          onPress={jest.fn()}
        />,
      );
    });

    // Color must update in place to yellow1
    expect(getMiddleOptionBgColor()).toEqual(Colors.yellow1);
  });

  it('re-colours text color in place when selected prop updates', () => {
    // Mount UserStatusSelector with selected set to Online
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <UserStatusSelector selected={UserStatus.Online} onPress={jest.fn()} />,
      );
    });

    // Helper to read middle option (Last Call) text color
    const getMiddleOptionTextColor = () => {
      const tree = component.toJSON() as any;
      const textNode = tree.children[1].children[0].children[0];
      return StyleSheet.flatten(textNode.props.style)?.color;
    };

    expect(getMiddleOptionTextColor()).toEqual(Colors.gray3);

    // Update selected prop to LastCall on the same mounted instance
    act(() => {
      component.update(
        <UserStatusSelector
          selected={UserStatus.LastCall}
          onPress={jest.fn()}
        />,
      );
    });

    // Last Call text color when selected must update in place to black1
    expect(getMiddleOptionTextColor()).toEqual(Colors.black1);
  });

  describe('pure helper functions', () => {
    describe('statusButtonStyle', () => {
      it('returns correct container style for each status', () => {
        expect(statusButtonStyle(UserStatus.Online)).toEqual(
          styles.containerLeft,
        );
        expect(statusButtonStyle(UserStatus.LastCall)).toEqual(
          styles.containerMiddle,
        );
        expect(statusButtonStyle(UserStatus.Offline)).toEqual(
          styles.containerRight,
        );
      });
    });

    describe('statusButtonColor', () => {
      it('returns brand colors (green1, yellow1, red1) when option is selected', () => {
        expect(statusButtonColor(UserStatus.Online, UserStatus.Online)).toEqual(
          Colors.green1,
        );
        expect(
          statusButtonColor(UserStatus.LastCall, UserStatus.LastCall),
        ).toEqual(Colors.yellow1);
        expect(
          statusButtonColor(UserStatus.Offline, UserStatus.Offline),
        ).toEqual(Colors.red1);
      });

      it('returns transparent when option is not selected', () => {
        expect(
          statusButtonColor(UserStatus.Online, UserStatus.Offline),
        ).toEqual(Colors.transparent);
        expect(
          statusButtonColor(UserStatus.LastCall, UserStatus.Online),
        ).toEqual(Colors.transparent);
        expect(
          statusButtonColor(UserStatus.Offline, UserStatus.Online),
        ).toEqual(Colors.transparent);
      });
    });

    describe('statusTextColor', () => {
      it('returns specific text color for each status when selected (white for Online/Offline, black1 for LastCall)', () => {
        // Assert all three selected branches explicitly
        expect(statusTextColor(UserStatus.Online, UserStatus.Online)).toEqual(
          Colors.white,
        );
        expect(
          statusTextColor(UserStatus.LastCall, UserStatus.LastCall),
        ).toEqual(Colors.black1);
        expect(statusTextColor(UserStatus.Offline, UserStatus.Offline)).toEqual(
          Colors.white,
        );
      });

      it('returns gray3 when option is not selected', () => {
        expect(statusTextColor(UserStatus.Online, UserStatus.Offline)).toEqual(
          Colors.gray3,
        );
        expect(statusTextColor(UserStatus.LastCall, UserStatus.Online)).toEqual(
          Colors.gray3,
        );
        expect(statusTextColor(UserStatus.Offline, UserStatus.Online)).toEqual(
          Colors.gray3,
        );
      });
    });
  });
});

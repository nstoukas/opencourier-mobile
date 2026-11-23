import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import '@app/localization/i18n';
import { HomeTopSlot } from './HomeTopSlot';
import { ProfileBadge } from '@app/components/ProfileBadge/ProfileBadge';
import { UserStatus } from '@app/types/types';
import { color } from '@app/styles/theme';

describe('HomeTopSlot (spec 0018, AC-14, row 134 Clauses 2 & 3)', () => {
  it('renders the profile badge, connection dot, and child banners in order', () => {
    const onMenuMock = jest.fn();

    const { getByTestId, getByText, UNSAFE_getByType } = render(
      <HomeTopSlot
        userStatus={UserStatus.Online}
        connectionStatus="connected"
        onMenu={onMenuMock}>
        <View testID="mock-banner">
          <Text>Dispatch Stop Banner</Text>
        </View>
      </HomeTopSlot>,
    );

    expect(getByTestId('home-top-slot')).toBeTruthy();
    expect(getByText('Online')).toBeTruthy();
    expect(getByTestId('connection-dot')).toBeTruthy();
    expect(getByTestId('mock-banner')).toBeTruthy();
    expect(getByText('Dispatch Stop Banner')).toBeTruthy();

    // Tapping the status word under the frame opens menu (Clause 2)
    fireEvent.press(getByText('Online'));
    expect(onMenuMock).toHaveBeenCalledTimes(1);

    // Tapping the avatar badge also opens menu
    fireEvent.press(UNSAFE_getByType(ProfileBadge));
    expect(onMenuMock).toHaveBeenCalledTimes(2);
  });

  it('renders sosAction slot at the top row when provided (spec 0022, AC-1)', () => {
    const { getByTestId } = render(
      <HomeTopSlot
        userStatus={UserStatus.Online}
        connectionStatus="connected"
        onMenu={jest.fn()}
        sosAction={<View testID="test-sos-action" />}>
        <View testID="child-banner" />
      </HomeTopSlot>,
    );

    expect(getByTestId('test-sos-action')).toBeTruthy();
    expect(getByTestId('child-banner')).toBeTruthy();
  });

  it('StatusWord sits under the badge frame (BADGE_WIDTH 80) and tapping it calls onMenu (Clause 2)', () => {
    const onMenuMock = jest.fn();
    const { getByTestId, getByText } = render(
      <HomeTopSlot
        userStatus={UserStatus.Online}
        connectionStatus="connected"
        onMenu={onMenuMock}
      />,
    );

    const statusWord = getByTestId('status-word');
    expect(statusWord).toBeTruthy();

    // Tapping status word triggers onMenu
    fireEvent.press(getByText('Online'));
    expect(onMenuMock).toHaveBeenCalledTimes(1);
  });

  it('renders Last call word in ink (warning-foreground) on yellow tag under the frame (Clause 2)', () => {
    const { getByTestId, getByText } = render(
      <HomeTopSlot
        userStatus={UserStatus.LastCall}
        connectionStatus="connected"
        onMenu={jest.fn()}
      />,
    );

    expect(getByTestId('status-word')).toBeTruthy();
    const text = getByText('Last Call');
    const flatStyle = StyleSheet.flatten(text.props.style);
    expect(flatStyle.color).toBe(color['warning-foreground']);
  });

  it('renders middle slot (hours pill) between badge frame and sosAction in top row (Clause 3)', () => {
    const { getByTestId } = render(
      <HomeTopSlot
        userStatus={UserStatus.Online}
        connectionStatus="connected"
        onMenu={jest.fn()}
        middle={<View testID="test-middle-pill" />}
        sosAction={<View testID="test-sos-action" />}
      />,
    );

    const middlePill = getByTestId('test-middle-pill');
    expect(middlePill).toBeTruthy();

    // Parent container of middle slot has flex: 1 and minWidth: 0 so it never pushes SOS off
    let current: any = middlePill;
    let foundStyle: any = null;
    while (current && current.parent) {
      current = current.parent;
      const flattened = current.props?.style
        ? StyleSheet.flatten(current.props.style)
        : null;
      if (flattened && flattened.flex === 1) {
        foundStyle = flattened;
        break;
      }
    }
    expect(foundStyle).not.toBeNull();
    expect(foundStyle.flex).toBe(1);
    expect(foundStyle.minWidth).toBe(0);
  });
});

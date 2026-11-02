import React from 'react';
import { Text, View } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import '@app/localization/i18n';
import { HomeTopSlot } from './HomeTopSlot';
import { UserStatus } from '@app/types/types';

describe('HomeTopSlot (spec 0018, AC-14)', () => {
  it('renders the profile badge, connection dot, and child banners in order', () => {
    const onMenuMock = jest.fn();

    const { getByTestId, getByText } = render(
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
    expect(getByText('online')).toBeTruthy();
    expect(getByTestId('connection-dot')).toBeTruthy();
    expect(getByTestId('mock-banner')).toBeTruthy();
    expect(getByText('Dispatch Stop Banner')).toBeTruthy();

    // Tapping profile badge opens menu
    fireEvent.press(getByText('online'));
    expect(onMenuMock).toHaveBeenCalledTimes(1);
  });
});

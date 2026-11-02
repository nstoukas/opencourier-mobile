import React from 'react';
import { render } from '@testing-library/react-native';
import '@app/localization/i18n';
import { ProfileBadge } from './ProfileBadge';
import { UserStatus } from '@app/types/types';

describe('ProfileBadge (spec 0018, AC-14)', () => {
  it('shows Online for UserStatus.Online and never the raw value', () => {
    const { getByText, queryByText } = render(
      <ProfileBadge userStatus={UserStatus.Online} onPress={jest.fn()} />,
    );

    expect(getByText('Online')).toBeTruthy();
    expect(queryByText('online')).toBeNull();
  });

  it('shows Offline for UserStatus.Offline and never the raw value', () => {
    const { getByText, queryByText } = render(
      <ProfileBadge userStatus={UserStatus.Offline} onPress={jest.fn()} />,
    );

    expect(getByText('Offline')).toBeTruthy();
    expect(queryByText('offline')).toBeNull();
  });

  it('shows Last Call for UserStatus.LastCall and never the raw value', () => {
    const { getByText, queryByText } = render(
      <ProfileBadge userStatus={UserStatus.LastCall} onPress={jest.fn()} />,
    );

    expect(getByText('Last Call')).toBeTruthy();
    expect(queryByText('last_call')).toBeNull();
  });
});

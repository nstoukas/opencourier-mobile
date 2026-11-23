import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import '@app/localization/i18n';
import { ProfileBadge, StatusWord } from './ProfileBadge';
import { UserStatus } from '@app/types/types';
import { Colors } from '@app/styles/colors';
import { color } from '@app/styles/theme';

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

describe('StatusWord (Clause 2: centered status word under frame)', () => {
  it('renders Last Call in ink (warning-foreground) on a yellow tag', () => {
    const { getByTestId, getByText } = render(
      <StatusWord userStatus={UserStatus.LastCall} />,
    );
    const container = getByTestId('status-word');
    expect(StyleSheet.flatten(container.props.style).backgroundColor).toBe(
      Colors.yellow1,
    );

    const text = getByText('Last Call');
    const flatStyle = StyleSheet.flatten(text.props.style);
    expect(flatStyle.color).toBe(color['warning-foreground']);
    expect(flatStyle.textAlign).toBe('center');
    expect(text.props.numberOfLines).toBe(2);
  });

  it('renders Online in white on a green tag', () => {
    const { getByTestId, getByText } = render(
      <StatusWord userStatus={UserStatus.Online} />,
    );
    const container = getByTestId('status-word');
    expect(StyleSheet.flatten(container.props.style).backgroundColor).toBe(
      Colors.green1,
    );

    const text = getByText('Online');
    const flatStyle = StyleSheet.flatten(text.props.style);
    expect(flatStyle.color).toBe(Colors.white);
    expect(flatStyle.textAlign).toBe('center');
  });

  it('renders Offline in white on a red tag', () => {
    const { getByTestId, getByText } = render(
      <StatusWord userStatus={UserStatus.Offline} />,
    );
    const container = getByTestId('status-word');
    expect(StyleSheet.flatten(container.props.style).backgroundColor).toBe(
      Colors.red1,
    );

    const text = getByText('Offline');
    const flatStyle = StyleSheet.flatten(text.props.style);
    expect(flatStyle.color).toBe(Colors.white);
    expect(flatStyle.textAlign).toBe('center');
  });
});

describe('ProfileBadge with hideStatusWord (Clause 2)', () => {
  it('hides StatusWord when hideStatusWord is true', () => {
    const { queryByTestId, queryByText } = render(
      <ProfileBadge
        userStatus={UserStatus.Online}
        onPress={jest.fn()}
        hideStatusWord={true}
      />,
    );

    expect(queryByTestId('status-word')).toBeNull();
    expect(queryByText('Online')).toBeNull();
  });
});

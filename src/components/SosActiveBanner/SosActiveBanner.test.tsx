import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import '@app/localization/i18n';
import { SosActiveBanner } from './SosActiveBanner';

describe('SosActiveBanner (spec 0022, AC-3)', () => {
  it('renders title and sharing note and calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId, getByText } = render(
      <SosActiveBanner onPress={onPress} />,
    );

    expect(getByTestId('sos-active-banner')).toBeTruthy();
    expect(getByText('SOS active')).toBeTruthy();
    expect(
      getByText(
        'Your position is shared with the co-op until you end this SOS.',
      ),
    ).toBeTruthy();

    fireEvent.press(getByTestId('sos-active-banner'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

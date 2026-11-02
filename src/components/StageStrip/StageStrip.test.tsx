import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { color } from '@app/styles/theme';
import { StageStrip } from './StageStrip';

describe('StageStrip (spec 0021, AC-6)', () => {
  it('renders pickup stage with Restaurant current and Customer next', () => {
    const { getByTestId, getByText } = render(
      <StageStrip
        stage="pickup"
        toRestaurant={{ km: '1.2', minutes: 4 }}
        toCustomer={{ km: '3.5', minutes: 8 }}
      />,
    );

    expect(getByTestId('job-stage-strip')).toBeTruthy();

    const restaurantLabel = getByText(
      `${i18n.t('translations:stage_restaurant')} · 1.2 km`,
    );
    expect(StyleSheet.flatten(restaurantLabel.props.style).color).toBe(
      color.foreground,
    );

    const customerLabel = getByText(
      `${i18n.t('translations:stage_customer')} · 3.5 km`,
    );
    expect(StyleSheet.flatten(customerLabel.props.style).color).toBe(
      color['muted-foreground'],
    );
  });

  it('renders dropoff stage with Restaurant done and Customer current', () => {
    const { getByText } = render(
      <StageStrip
        stage="dropoff"
        toRestaurant={{ km: '1.2', minutes: 4 }}
        toCustomer={{ km: '2.8', minutes: 6 }}
      />,
    );

    // At dropoff, restaurant km is hidden and restaurant is done
    const restaurantLabel = getByText(i18n.t('translations:stage_restaurant'));
    expect(StyleSheet.flatten(restaurantLabel.props.style).color).toBe(
      color['muted-foreground'],
    );

    // Customer is current with km
    const customerLabel = getByText(
      `${i18n.t('translations:stage_customer')} · 2.8 km`,
    );
    expect(StyleSheet.flatten(customerLabel.props.style).color).toBe(
      color.foreground,
    );
  });

  it('renders stops without km when leg figures are not available', () => {
    const { getByText } = render(<StageStrip stage="pickup" />);

    expect(getByText(i18n.t('translations:stage_restaurant'))).toBeTruthy();
    expect(getByText(i18n.t('translations:stage_customer'))).toBeTruthy();
  });
});

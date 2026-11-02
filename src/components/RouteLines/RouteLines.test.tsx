import React from 'react';
import { render } from '@testing-library/react-native';
import { RouteLines } from './RouteLines';
import i18n from '@app/localization/i18n';

describe('RouteLines (spec 0018, AC-7)', () => {
  it('renders "To the restaurant" and "To the customer" lines with formatted km and minutes', () => {
    const { getByTestId } = render(
      <RouteLines
        toRestaurant={{ km: '1.2', minutes: 4 }}
        toCustomer={{ km: '2.9', minutes: 5 }}
        unavailable={false}
      />,
    );

    const restaurantLine = getByTestId('route-line-restaurant');
    const customerLine = getByTestId('route-line-customer');

    expect(restaurantLine.props.children).toBe(
      i18n.t('translations:route_to_restaurant', { km: '1.2', minutes: 4 }),
    );
    expect(customerLine.props.children).toBe(
      i18n.t('translations:route_to_customer', { km: '2.9', minutes: 5 }),
    );
  });

  it('renders only toCustomer when toRestaurant is undefined', () => {
    const { getByTestId, queryByTestId } = render(
      <RouteLines
        toCustomer={{ km: '3.5', minutes: 8 }}
        unavailable={false}
      />,
    );

    expect(queryByTestId('route-line-restaurant')).toBeNull();
    expect(getByTestId('route-line-customer')).toBeTruthy();
  });

  it('renders "Route not available" when unavailable is true and no legs are present', () => {
    const { getByTestId, queryByTestId } = render(
      <RouteLines unavailable={true} />,
    );

    expect(getByTestId('route-unavailable')).toBeTruthy();
    expect(getByTestId('route-unavailable').props.children).toBe(
      i18n.t('translations:route_not_available'),
    );
    expect(queryByTestId('route-line-restaurant')).toBeNull();
    expect(queryByTestId('route-line-customer')).toBeNull();
  });

  it('renders lines and does not render "Route not available" if data is present even when unavailable is true', () => {
    const { queryByTestId, getByTestId } = render(
      <RouteLines
        toCustomer={{ km: '1.0', minutes: 2 }}
        unavailable={true}
      />,
    );

    expect(queryByTestId('route-unavailable')).toBeNull();
    expect(getByTestId('route-line-customer')).toBeTruthy();
  });

  it('renders nothing when no legs are present and unavailable is false', () => {
    const { toJSON } = render(<RouteLines unavailable={false} />);
    expect(toJSON()).toBeNull();
  });
});

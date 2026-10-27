import React from 'react';
import renderer from 'react-test-renderer';
import { InProgressMap } from './InProgressMap';
import { Order, User, UserStatus } from '@app/types/types';
import '@app/localization/i18n';

jest.mock('../Map/Map', () => {
  const { View } = require('react-native');
  return () => <View testID="mock-map" />;
});

describe('InProgressMap (Row 66, Clause 4)', () => {
  const dummyUser: User = {
    id: 'user-1',
    status: UserStatus.Online,
  } as unknown as User;

  const dummyOrder: Order = {
    id: 'order-1',
  } as unknown as Order;

  it('renders distance in km with one decimal place and never "mi"', () => {
    const component = renderer.create(
      <InProgressMap
        user={dummyUser}
        order={dummyOrder}
        distance={3100} // 3.1 km
        duration={180}
      />,
    );

    const json = JSON.stringify(component.toJSON());
    expect(json).toContain('3.1 km');
    expect(json).not.toMatch(/\bmi\b/);
    expect(json).not.toContain('miles');
  });

  it('renders 300 meters as 0.3 km, not 1 mi', () => {
    const component = renderer.create(
      <InProgressMap
        user={dummyUser}
        order={dummyOrder}
        distance={300} // 0.3 km
        duration={60}
      />,
    );

    const json = JSON.stringify(component.toJSON());
    expect(json).toContain('0.3 km');
    expect(json).not.toMatch(/\bmi\b/);
  });
});

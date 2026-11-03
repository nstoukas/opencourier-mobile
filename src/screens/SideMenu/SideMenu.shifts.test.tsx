import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SideMenuItem } from '@app/types/types';
import { DrawerScreens } from '@app/navigation/drawer/types';
import { useJobContact } from '@app/hooks/useJobContact';
import '@app/localization/i18n';

// The same native and hook mocks as SideMenu.test.tsx, plus the co-op's switch (useJobContact).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-navigation/drawer', () => {
  const { View } = require('react-native');
  return {
    DrawerContentScrollView: ({ children }: { children: React.ReactNode }) => (
      <View testID="drawer-scroll">{children}</View>
    ),
  };
});

jest.mock('@app/services/offerPush/registration', () => ({
  unregisterThisPhone: jest.fn(),
}));

jest.mock('@app/services/service', () => ({
  services: {
    userService: { setUserStatus: jest.fn() },
    logout: jest.fn(),
  },
}));

jest.mock('@app/hooks/useUser', () => () => ({
  user: {
    id: 'courier-1',
    status: 'ONLINE',
    deliverySetting: 'MANUAL',
    name: 'Courier User',
  },
  updateStatus: jest.fn(),
  updateDeliverySettings: jest.fn(),
}));

jest.mock('@app/hooks/useLocationPermission', () => ({
  useLocationPermission: () => ({
    locationPermission: false,
    requestLocationPermission: jest.fn(),
  }),
}));

jest.mock('@app/hooks/useInstance', () => () => ({
  userInstances: [],
  isLoadingInstances: false,
}));

jest.mock('@app/hooks/useJobContact', () => ({
  useJobContact: jest.fn(),
}));

import { SideMenu } from './SideMenu';
import { SideMenuItemPlain } from '@app/components/SideMenuItemPlain/SideMenuItemPlain';

// Spec 0027 (AC-1, AC-10): Shifts sits after History in the side menu, only while the co-op runs shifts.
describe('SideMenu Shifts item (spec 0027, AC-1, AC-10)', () => {
  let queryClient: QueryClient;
  let navigation: { navigate: jest.Mock; closeDrawer: jest.Mock };

  const contact = (data: unknown) =>
    (useJobContact as jest.Mock).mockReturnValue({ data });

  const items = () => {
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <QueryClientProvider client={queryClient}>
          <SideMenu {...({ navigation } as any)} />
        </QueryClientProvider>,
      );
    });
    return component!.root
      .findAllByType(SideMenuItemPlain)
      .map(item => item.props.item as SideMenuItem);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    navigation = { navigate: jest.fn(), closeDrawer: jest.fn() };
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('with shiftsEnabled true, lists Shifts right after History', () => {
    contact({ dispatchPhoneNumber: null, shiftsEnabled: true });
    const list = items();
    expect(list).toContain(SideMenuItem.Shifts);
    expect(list.indexOf(SideMenuItem.Shifts)).toBe(
      list.indexOf(SideMenuItem.History) + 1,
    );
    expect(list.filter(item => item === SideMenuItem.Shifts)).toHaveLength(1);
  });

  it('keeps every other item, in the same order, with Shifts on', () => {
    contact({ dispatchPhoneNumber: null, shiftsEnabled: false });
    const off = items();
    contact({ dispatchPhoneNumber: null, shiftsEnabled: true });
    const on = items();
    expect(on.filter(item => item !== SideMenuItem.Shifts)).toEqual(off);
  });

  it.each([
    [
      'shiftsEnabled false',
      { dispatchPhoneNumber: null, shiftsEnabled: false },
    ],
    ['an older saved answer without the field', { dispatchPhoneNumber: null }],
    ['no answer yet', undefined],
  ])('has no Shifts item with %s', (_case, data) => {
    contact(data);
    expect(items()).not.toContain(SideMenuItem.Shifts);
  });

  it('pressing Shifts opens the Shifts screen', () => {
    contact({ dispatchPhoneNumber: null, shiftsEnabled: true });
    let component: renderer.ReactTestRenderer;
    act(() => {
      component = renderer.create(
        <QueryClientProvider client={queryClient}>
          <SideMenu {...({ navigation } as any)} />
        </QueryClientProvider>,
      );
    });
    const shifts = component!.root
      .findAllByType(SideMenuItemPlain)
      .find(item => item.props.item === SideMenuItem.Shifts);
    act(() => {
      shifts!.props.onPress(SideMenuItem.Shifts);
    });
    expect(navigation.navigate).toHaveBeenCalledWith(DrawerScreens.Shifts);
  });

  it('reads the last switch without polling (useJobContact(false))', () => {
    contact({ dispatchPhoneNumber: null, shiftsEnabled: true });
    items();
    expect(useJobContact).toHaveBeenCalledWith(false);
  });
});

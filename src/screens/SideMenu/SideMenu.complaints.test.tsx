import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@app/localization/i18n';
import { SideMenuItem } from '@app/types/types';
import { DrawerScreens } from '@app/navigation/drawer/types';
import { SideMenu } from './SideMenu';
import { SideMenuItemPlain } from '@app/components/SideMenuItemPlain/SideMenuItemPlain';

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

jest.mock('@app/hooks/useUser', () => () => ({
  user: { id: 'courier-comp-1', firstName: 'Nikos', status: 'ONLINE' },
  updateStatus: jest.fn(),
  updateDeliverySettings: jest.fn(),
}));

let mockShiftsEnabled = false;
jest.mock('@app/hooks/useJobContact', () => ({
  useJobContact: () => ({
    data: { shiftsEnabled: mockShiftsEnabled },
  }),
}));

// Spec 0052 (cross check 11, AC-8): Complaints in SideMenu, after Earnings, with NO count or badge.
describe('SideMenu Complaints item (spec 0052, cross check 11, AC-8)', () => {
  let queryClient: QueryClient;
  let renderedComponents: renderer.ReactTestRenderer[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    mockShiftsEnabled = false;
    queryClient = new QueryClient({
      // Row 158: gcTime Infinity, as in the other SideMenu tests: no garbage collection timer is scheduled when
      // an observer unmounts, so the Jest worker can exit (it was force exited before).
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false, gcTime: Infinity },
      },
    });
  });

  afterEach(async () => {
    act(() => {
      while (renderedComponents.length) {
        renderedComponents.pop()?.unmount();
      }
    });
    await act(async () => {});
    queryClient.clear();
  });

  const renderSideMenu = (nav?: any) => {
    const mockNav = nav ?? {
      navigate: jest.fn(),
      closeDrawer: jest.fn(),
    };
    const tree = renderer.create(
      <QueryClientProvider client={queryClient}>
        <SideMenu {...({ navigation: mockNav } as any)} />
      </QueryClientProvider>,
    );
    renderedComponents.push(tree);
    return { tree, nav: mockNav };
  };

  it('lists Complaints right after Earnings in the side menu (standard menu)', () => {
    mockShiftsEnabled = false;
    const { tree } = renderSideMenu();

    const plainItems = tree.root.findAllByType(SideMenuItemPlain);
    const itemKeys = plainItems.map(p => p.props.item);

    const earningsIndex = itemKeys.indexOf(SideMenuItem.Earnings);
    const complaintsIndex = itemKeys.indexOf(SideMenuItem.Complaints);
    const payoutIndex = itemKeys.indexOf(SideMenuItem.Payout);

    expect(earningsIndex).toBeGreaterThanOrEqual(0);
    expect(complaintsIndex).toBe(earningsIndex + 1);
    expect(payoutIndex).toBe(complaintsIndex + 1);
  });

  it('lists Complaints right after Earnings when shifts are enabled', () => {
    mockShiftsEnabled = true;
    const { tree } = renderSideMenu();

    const plainItems = tree.root.findAllByType(SideMenuItemPlain);
    const itemKeys = plainItems.map(p => p.props.item);

    const earningsIndex = itemKeys.indexOf(SideMenuItem.Earnings);
    const complaintsIndex = itemKeys.indexOf(SideMenuItem.Complaints);

    expect(earningsIndex).toBeGreaterThanOrEqual(0);
    expect(complaintsIndex).toBe(earningsIndex + 1);
  });

  it('navigates to DrawerScreens.Complaints when Complaints item is pressed', () => {
    const { tree, nav } = renderSideMenu();

    const plainItems = tree.root.findAllByType(SideMenuItemPlain);
    const complaintsItem = plainItems.find(
      p => p.props.item === SideMenuItem.Complaints,
    );
    expect(complaintsItem).toBeDefined();

    act(() => {
      complaintsItem!.props.onPress(SideMenuItem.Complaints);
    });

    expect(nav.navigate).toHaveBeenCalledTimes(1);
    expect(nav.navigate).toHaveBeenCalledWith(DrawerScreens.Complaints);
  });

  it('has no dot, badge, or count on the Complaints menu item (Value 5, AC-8)', () => {
    const { tree } = renderSideMenu();

    const plainItems = tree.root.findAllByType(SideMenuItemPlain);
    const complaintsItem = plainItems.find(
      p => p.props.item === SideMenuItem.Complaints,
    );

    expect(complaintsItem).toBeDefined();
    expect(complaintsItem!.props.dot).toBeFalsy();
    // No count badge child
    const textChildren = complaintsItem!.findAllByType('Text' as any);
    const textContents = textChildren
      .map((t: any) =>
        Array.isArray(t.props.children)
          ? t.props.children.join('')
          : t.props.children,
      )
      .filter(Boolean);

    // Only the menu label 'Complaints' exists, no count string like '1' or '0'
    expect(textContents.some((t: string) => /^\d+$/.test(t.trim()))).toBe(
      false,
    );
  });
});

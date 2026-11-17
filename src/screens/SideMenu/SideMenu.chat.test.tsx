import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@app/localization/i18n';
import { SideMenuItem } from '@app/types/types';
import { MainScreens } from '@app/navigation/main/types';
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
  user: { id: 'courier-chat-1', firstName: 'Nikos', status: 'ONLINE' },
  updateStatus: jest.fn(),
  updateDeliverySettings: jest.fn(),
}));

jest.mock('@app/hooks/useInstance', () => () => ({
  userInstances: [],
  isLoadingInstances: false,
}));

let mockShiftsEnabled = false;
jest.mock('@app/hooks/useJobContact', () => ({
  useJobContact: () => ({
    data: { shiftsEnabled: mockShiftsEnabled },
  }),
}));

const mockChatUnseen = jest.fn();
jest.mock('@app/hooks/useChat', () => ({
  useChatUnseen: () => mockChatUnseen(),
}));

describe('SideMenu Chat entry point (spec 0034, AC-12)', () => {
  let queryClient: QueryClient;
  let renderedComponents: renderer.ReactTestRenderer[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    mockShiftsEnabled = false;
    mockChatUnseen.mockReturnValue(false);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
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

  it('lists Chat between Orders and History in the side menu (standard menu)', () => {
    mockShiftsEnabled = false;
    const { tree } = renderSideMenu();

    const plainItems = tree.root.findAllByType(SideMenuItemPlain);
    const itemKeys = plainItems.map(p => p.props.item);

    const ordersIndex = itemKeys.indexOf(SideMenuItem.Orders);
    const chatIndex = itemKeys.indexOf(SideMenuItem.Chat);
    const historyIndex = itemKeys.indexOf(SideMenuItem.History);

    expect(ordersIndex).toBeGreaterThanOrEqual(0);
    expect(chatIndex).toBe(ordersIndex + 1);
    expect(historyIndex).toBe(chatIndex + 1);
  });

  it('lists Chat between Orders and History when shifts are available', () => {
    mockShiftsEnabled = true;
    const { tree } = renderSideMenu();

    const plainItems = tree.root.findAllByType(SideMenuItemPlain);
    const itemKeys = plainItems.map(p => p.props.item);

    const ordersIndex = itemKeys.indexOf(SideMenuItem.Orders);
    const chatIndex = itemKeys.indexOf(SideMenuItem.Chat);
    const historyIndex = itemKeys.indexOf(SideMenuItem.History);
    const shiftsIndex = itemKeys.indexOf(SideMenuItem.Shifts);

    expect(ordersIndex).toBeGreaterThanOrEqual(0);
    expect(chatIndex).toBe(ordersIndex + 1);
    expect(historyIndex).toBe(chatIndex + 1);
    expect(shiftsIndex).toBe(historyIndex + 1);
  });

  it('navigates to MainScreens.Chat with no params when Chat item is pressed', () => {
    const { tree, nav } = renderSideMenu();

    const plainItems = tree.root.findAllByType(SideMenuItemPlain);
    const chatItem = plainItems.find(p => p.props.item === SideMenuItem.Chat);
    expect(chatItem).toBeDefined();

    act(() => {
      chatItem!.props.onPress(SideMenuItem.Chat);
    });

    expect(nav.navigate).toHaveBeenCalledTimes(1);
    expect(nav.navigate).toHaveBeenCalledWith(MainScreens.Chat);
  });

  it('draws the unread dot (side-menu-chat-dot) when chatUnseen is true', () => {
    mockChatUnseen.mockReturnValue(true);
    const { tree } = renderSideMenu();

    const plainItems = tree.root.findAllByType(SideMenuItemPlain);
    const chatItem = plainItems.find(p => p.props.item === SideMenuItem.Chat);
    expect(chatItem).toBeDefined();
    expect(chatItem!.props.dot).toBe(true);

    const dotView = chatItem!.findAllByProps({ testID: 'side-menu-chat-dot' });
    expect(dotView.length).toBeGreaterThan(0);
  });

  it('does NOT draw the unread dot when chatUnseen is false', () => {
    mockChatUnseen.mockReturnValue(false);
    const { tree } = renderSideMenu();

    const plainItems = tree.root.findAllByType(SideMenuItemPlain);
    const chatItem = plainItems.find(p => p.props.item === SideMenuItem.Chat);
    expect(chatItem).toBeDefined();
    expect(chatItem!.props.dot).toBe(false);

    const dotView = chatItem!.findAllByProps({ testID: 'side-menu-chat-dot' });
    expect(dotView.length).toBe(0);
  });
});

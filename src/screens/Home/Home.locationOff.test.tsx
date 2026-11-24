import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomeScreen } from './Home';
import { User, UserStatus } from '@app/types/types';
import { OrderSetting } from '@app/types/enums';
import { setLocationOff } from '@app/services/locationOff';
import '@app/localization/i18n';

let mockIsFocused = true;
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const mockReact = require('react');
  return {
    ...actual,
    useIsFocused: () => mockIsFocused,
    useFocusEffect: (callback: () => void | (() => void)) => {
      mockReact.useEffect(() => {
        return callback();
      }, [callback]);
    },
  };
});

jest.mock('@app/hooks/useDispatchState', () => ({
  useDispatchState: () => ({
    data: { current: null, next: null },
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@app/hooks/useJobContact', () => ({
  useJobContact: () => ({
    data: { dispatchPhoneNumber: '+302421012345' },
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

let mockUser: User | undefined = {
  id: 'courier-1',
  status: UserStatus.Online,
  deliverySetting: OrderSetting.manual,
  createdAt: new Date().toISOString(),
} as User;

jest.mock('@app/hooks/useUser', () => () => ({
  user: mockUser,
  isLoading: false,
  updateStatus: jest.fn(),
}));

jest.mock('@app/hooks/useLocationPermission', () => ({
  useLocationPermission: () => ({
    locationPermission: true,
    requestLocationPermission: jest.fn(),
  }),
}));

describe('HomeScreen LocationOffBanner integration (Row 156, Clause 1, 3)', () => {
  let queryClient: QueryClient;
  let consoleErrorSpy: jest.SpyInstance;
  const mockNavigation: any = {
    navigate: jest.fn(),
    dispatch: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    setLocationOff(false);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  afterEach(() => {
    cleanup();
    consoleErrorSpy.mockRestore();
    queryClient.clear();
    setLocationOff(false);
  });

  const renderHome = async () => {
    const rendered = render(
      <QueryClientProvider client={queryClient}>
        <HomeScreen navigation={mockNavigation} route={{} as any} />
      </QueryClientProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    return rendered;
  };

  it('renders LocationOffBanner on Home while Online and locationOff is true (Clause 1)', async () => {
    mockUser = {
      id: 'courier-1',
      status: UserStatus.Online,
      deliverySetting: OrderSetting.manual,
      createdAt: new Date().toISOString(),
    } as User;
    setLocationOff(true);

    await renderHome();

    expect(screen.getByTestId('location-off-banner')).toBeTruthy();
    expect(screen.getByText('Location off')).toBeTruthy();
    expect(screen.getByText('Turn on')).toBeTruthy();
  });

  it('renders LocationOffBanner on Home while on Last call and locationOff is true (Clause 1)', async () => {
    mockUser = {
      id: 'courier-1',
      status: UserStatus.LastCall,
      deliverySetting: OrderSetting.manual,
      createdAt: new Date().toISOString(),
    } as User;
    setLocationOff(true);

    await renderHome();

    expect(screen.getByTestId('location-off-banner')).toBeTruthy();
    expect(screen.getByText('Location off')).toBeTruthy();
    expect(screen.getByText('Turn on')).toBeTruthy();
  });

  it('never renders LocationOffBanner on Home while Offline even if locationOff is true (Clause 3)', async () => {
    mockUser = {
      id: 'courier-1',
      status: UserStatus.Offline,
      deliverySetting: OrderSetting.manual,
      createdAt: new Date().toISOString(),
    } as User;
    setLocationOff(true);

    await renderHome();

    expect(screen.queryByTestId('location-off-banner')).toBeNull();
  });

  it('does not render LocationOffBanner on Home when locationOff is false', async () => {
    mockUser = {
      id: 'courier-1',
      status: UserStatus.Online,
      deliverySetting: OrderSetting.manual,
      createdAt: new Date().toISOString(),
    } as User;
    setLocationOff(false);

    await renderHome();

    expect(screen.queryByTestId('location-off-banner')).toBeNull();
  });
});

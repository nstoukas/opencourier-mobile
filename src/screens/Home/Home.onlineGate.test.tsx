import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomeScreen } from './Home';
import { User, UserStatus } from '@app/types/types';
import { OrderSetting } from '@app/types/enums';
import { HomeCard } from '@app/components/HomeCard/HomeCard';
import * as locationForOnline from '@app/services/locationForOnline';
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

const mockUpdateStatus = jest.fn();
let mockUser: User | undefined = {
  id: 'courier-1',
  status: UserStatus.Offline,
  deliverySetting: OrderSetting.manual,
  createdAt: new Date().toISOString(),
} as User;

jest.mock('@app/hooks/useUser', () => () => ({
  user: mockUser,
  isLoading: false,
  updateStatus: mockUpdateStatus,
}));

const mockRequestLocationPermission = jest.fn();
jest.mock('@app/hooks/useLocationPermission', () => ({
  useLocationPermission: () => ({
    locationPermission: false,
    requestLocationPermission: mockRequestLocationPermission,
  }),
}));

describe('Home screen going Online gate (spec 0039, AC-16)', () => {
  let queryClient: QueryClient;
  const mockNavigation: any = {
    navigate: jest.fn(),
    dispatch: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = {
      id: 'courier-1',
      status: UserStatus.Offline,
      deliverySetting: OrderSetting.manual,
      createdAt: new Date().toISOString(),
    } as User;
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderHome = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <HomeScreen navigation={mockNavigation} route={{} as any} />
      </QueryClientProvider>,
    );

  it('going Online with location refused keeps the rider Offline and returns swipe knob to start (Clause 10)', async () => {
    jest
      .spyOn(locationForOnline, 'confirmLocationForOnline')
      .mockResolvedValue(false);

    renderHome();

    const homeCard = screen.UNSAFE_getByType(HomeCard);
    expect(homeCard.props.mode).toBe('offline');
    expect(homeCard.props.goOnlineAttempt).toBe(0);

    // Trigger swipe to go Online
    await act(async () => {
      await homeCard.props.onGoOnline(true);
    });

    expect(mockUpdateStatus).not.toHaveBeenCalled();

    // The attempt counter increments to change the ButtonSwipe key, springing the knob back
    const updatedHomeCard = screen.UNSAFE_getByType(HomeCard);
    expect(updatedHomeCard.props.goOnlineAttempt).toBe(1);
  });

  it('going Online with location granted sets the rider Online', async () => {
    jest
      .spyOn(locationForOnline, 'confirmLocationForOnline')
      .mockResolvedValue(true);

    renderHome();

    const homeCard = screen.UNSAFE_getByType(HomeCard);

    // Trigger swipe to go Online
    await act(async () => {
      await homeCard.props.onGoOnline(true);
    });

    expect(mockUpdateStatus).toHaveBeenCalledWith(UserStatus.Online);
  });
});

import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import i18n from '@app/localization/i18n';
import { TimeWorkedCounter } from './TimeWorkedCounter';
import { useCurrentTimeWorked } from '@app/hooks/useTimeWorked';
import { CounterView } from '@app/utilities/timeWorked';
import { HomeScreen } from '@app/screens/Home/Home';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';

jest.mock('@app/hooks/useTimeWorked', () => ({
  useCurrentTimeWorked: jest.fn(),
}));

// Mock hooks needed for Home rendering check
jest.mock('@app/hooks/useDispatchState', () => ({
  useDispatchState: jest.fn(() => ({ data: { current: null, next: null } })),
}));
jest.mock('@app/hooks/useJobContact', () => ({
  useJobContact: jest.fn(() => ({ data: { dispatchPhoneNumber: '+30111' } })),
}));
jest.mock('@app/hooks/useUser', () => () => ({
  user: { id: 'c1', status: 'ONLINE' },
  isLoading: false,
  updateStatus: jest.fn(),
}));
jest.mock('@app/hooks/useLocationPermission', () => ({
  useLocationPermission: () => ({
    locationPermission: true,
    requestLocationPermission: jest.fn(),
  }),
}));
jest.mock('@app/hooks/useHomeOrders', () => ({
  useHomeOrders: () => ({
    dataSourceNew: [],
    dataSourceInProgress: [],
    serverInProgress: [],
    timeLeftForOffer: jest.fn(),
    totalTimeForOffer: jest.fn(),
    waitedTimeForOffer: jest.fn(),
    refetchNew: jest.fn(),
    refetchInProgress: jest.fn(),
    declineOrderFn: jest.fn(),
    acceptOrderFn: jest.fn(),
    isLoading: false,
  }),
}));
jest.mock('@app/services/socket', () => ({
  useConnectionStatus: () => 'connected',
}));
jest.mock('@app/hooks/useMoveDropoffPin', () => ({
  ...jest.requireActual('@app/hooks/useMoveDropoffPin'),
  useMoveDropoffPin: () => ({ movePin: jest.fn(), movingId: null }),
}));
jest.mock('@app/hooks/useShifts', () => ({
  useShifts: () => ({ shiftsOn: false, data: undefined }),
}));
jest.mock('@app/hooks/useHandBack', () => ({
  useHandBack: () => ({ handBack: jest.fn(), handingBackId: null }),
}));
jest.mock('@app/hooks/useLeaveWait', () => ({
  useLeaveWait: () => ({ leaveWait: jest.fn(), leavingId: null }),
}));
jest.mock('@app/hooks/useRemovalRequest', () => ({
  useWithdrawRemoval: () => jest.fn(),
  useRemovalBusy: () => false,
}));
jest.mock('@app/hooks/useDeliveryRoute', () => ({
  useDeliveryRoute: () => ({ legs: [] }),
}));
jest.mock('@app/hooks/usePickupPoints', () => ({
  usePickupPoints: () => [],
}));
jest.mock('@app/hooks/useNavigateTo', () => ({
  useNavigateTo: () => jest.fn(),
}));
jest.mock('@app/hooks/useSos', () => ({
  useSosRecord: () => null,
  beginSos: jest.fn(),
  openSosScreen: jest.fn(),
}));
jest.mock('@app/services/ownPosition', () => ({
  useOwnPosition: () => null,
  setOwnPosition: jest.fn(),
}));
jest.mock('@app/hooks/useChat', () => ({
  useChatUnseen: () => 0,
}));

describe('TimeWorkedCounter (spec 0040, AC-10)', () => {
  const mockView = (view: CounterView) => {
    (useCurrentTimeWorked as jest.Mock).mockReturnValue({
      view,
      query: { isSuccess: true, data: {} },
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when there is no open shift (kind: "none")', () => {
    mockView({ kind: 'none' });
    const { toJSON } = render(<TimeWorkedCounter />);
    expect(toJSON()).toBeNull();
    expect(screen.queryByTestId('time-worked-counter')).toBeNull();
  });

  it('renders "3h12 · €38.50 · €12.00/h" for a working view without saying "online"', () => {
    mockView({
      kind: 'working',
      workSeconds: 11520, // 3h12
      moneyCents: 3850, // €38.50
      centsPerHour: 1200, // €12.00/h
      currencyCode: 'EUR',
    });

    render(<TimeWorkedCounter />);
    const textElement = screen.getByText('3h12 · €38.50 · €12.00/h');
    expect(textElement).toBeTruthy();
    expect(screen.queryByText(/online/i)).toBeNull();
    expect(textElement.props.numberOfLines).toBe(1);
    expect(textElement.props.adjustsFontSizeToFit).toBe(true);
    expect(textElement.props.minimumFontScale).toBe(0.75);
  });

  it('renders "48 min · €15.00 · €18.75/h" under an hour without saying "online"', () => {
    mockView({
      kind: 'working',
      workSeconds: 48 * 60, // 48 min
      moneyCents: 1500, // €15.00
      centsPerHour: 1875, // €18.75/h
      currencyCode: 'EUR',
    });

    render(<TimeWorkedCounter />);
    expect(screen.getByText('48 min · €15.00 · €18.75/h')).toBeTruthy();
    expect(screen.queryByText(/online/i)).toBeNull();
  });

  // Row 137: the pill's minutes in the app's language; from an hour it reads the same in both.
  describe('in Greek (row 137)', () => {
    beforeEach(async () => {
      await act(async () => {
        await i18n.changeLanguage('el');
      });
    });

    afterEach(async () => {
      // jest.setup.js pins English; hand it back.
      await act(async () => {
        await i18n.changeLanguage('en');
      });
    });

    it('starts with "48 λ." under an hour and never says "min"', () => {
      mockView({
        kind: 'working',
        workSeconds: 48 * 60,
        moneyCents: 1500,
        centsPerHour: null,
        currencyCode: 'EUR',
      });

      render(<TimeWorkedCounter />);
      expect(screen.getByText(/^48 λ\. · /)).toBeTruthy();
      expect(screen.queryByText(/min/)).toBeNull();
    });

    it('starts with "3h12" from an hour', () => {
      mockView({
        kind: 'working',
        workSeconds: 11520,
        moneyCents: 3850,
        centsPerHour: null,
        currencyCode: 'EUR',
      });

      render(<TimeWorkedCounter />);
      expect(screen.getByText(/^3h12 · /)).toBeTruthy();
    });
  });

  it('renders "—" for the rate under a minute (centsPerHour is null) without saying "online"', () => {
    mockView({
      kind: 'working',
      workSeconds: 45, // 0 min
      moneyCents: 0,
      centsPerHour: null,
      currencyCode: 'EUR',
    });

    render(<TimeWorkedCounter />);
    expect(screen.getByText('0 min · €0.00 · —')).toBeTruthy();
    expect(screen.queryByText(/online/i)).toBeNull();
  });

  it('renders "On break 12 min" on a break', () => {
    mockView({
      kind: 'break',
      breakMinutes: 12,
    });

    render(<TimeWorkedCounter />);
    expect(screen.getByText('On break 12 min')).toBeTruthy();
  });

  it('passes inFront prop to useCurrentTimeWorked', () => {
    mockView({ kind: 'none' });
    render(<TimeWorkedCounter inFront={false} />);
    expect(useCurrentTimeWorked).toHaveBeenCalledWith(false);

    render(<TimeWorkedCounter inFront={true} />);
    expect(useCurrentTimeWorked).toHaveBeenCalledWith(true);
  });

  describe('Home screen placement', () => {
    let qc: QueryClient;

    beforeEach(() => {
      jest.useFakeTimers();
      qc = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });
    });

    afterEach(() => {
      cleanup();
      qc.clear();
      jest.useRealTimers();
    });

    it('Home renders TimeWorkedCounter inside the top slot (HomeTopSlot), not in the bottom card (HomeCard)', () => {
      mockView({
        kind: 'working',
        workSeconds: 11520,
        moneyCents: 3850,
        centsPerHour: 1200,
        currencyCode: 'EUR',
      });

      const mockNav: any = { toggleDrawer: jest.fn(), navigate: jest.fn() };
      const mockRoute: any = { key: 'home', name: 'Home' };

      const { unmount } = render(
        <QueryClientProvider client={qc}>
          <NavigationContainer>
            <HomeScreen navigation={mockNav} route={mockRoute} />
          </NavigationContainer>
        </QueryClientProvider>,
      );

      const counter = screen.getByTestId('time-worked-counter');
      expect(counter).toBeTruthy();

      // Find top slot
      const topSlot = screen.getByTestId('home-top-slot');
      // The counter must be a descendant of home-top-slot
      expect(topSlot).toBeTruthy();

      // And home-card must NOT contain the counter
      const homeCard = screen.getByTestId('home-card-online');
      expect(homeCard).toBeTruthy();
      // Verify counter is inside topSlot and not inside homeCard
      const isDescendantOf = (parent: any, child: any): boolean => {
        if (!parent || !child) {
          return false;
        }
        if (parent === child) {
          return true;
        }
        if (parent.children) {
          return parent.children.some((c: any) => isDescendantOf(c, child));
        }
        return false;
      };

      expect(isDescendantOf(topSlot, counter)).toBe(true);
      expect(isDescendantOf(homeCard, counter)).toBe(false);

      unmount();
    });
  });
});

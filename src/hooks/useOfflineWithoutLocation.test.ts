import { AppState, AppStateStatus } from 'react-native';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useOfflineWithoutLocation } from './useOfflineWithoutLocation';
import { User, UserStatus } from '@app/types/types';
import * as permissionsUtil from '@app/utilities/permissions';
import * as locationForOnline from '@app/services/locationForOnline';
import * as afterLogin from '@app/services/afterLogin';
import { services } from '@app/services/service';

const mockUpdateStatus = jest.fn();
jest.mock('@app/hooks/useUser', () => () => ({
  user: undefined,
  updateStatus: mockUpdateStatus,
}));

const mockRequestLocationPermission = jest.fn();
jest.mock('@app/hooks/useLocationPermission', () => ({
  useLocationPermission: () => ({
    locationPermission: false,
    requestLocationPermission: mockRequestLocationPermission,
  }),
}));

describe('useOfflineWithoutLocation (spec 0039, AC-16, Clause 7)', () => {
  let showLocationOffAlertSpy: jest.SpyInstance;
  let getInProgressOrdersSpy: jest.SpyInstance;
  let getUserSpy: jest.SpyInstance;
  let appStateListener: ((state: AppStateStatus) => void) | undefined;

  const onlineUser: User = {
    id: 'courier-1',
    status: UserStatus.Online,
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    showLocationOffAlertSpy = jest
      .spyOn(locationForOnline, 'showLocationOffAlert')
      .mockResolvedValue(undefined);
    getInProgressOrdersSpy = jest
      .spyOn(services.orderService, 'getInProgressOrders')
      .mockResolvedValue([]);
    getUserSpy = jest
      .spyOn(services.userService, 'getUser')
      .mockResolvedValue(onlineUser);

    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((event, listener) => {
        if (event === 'change') {
          appStateListener = listener;
        }
        return { remove: jest.fn() } as any;
      });
  });

  afterEach(() => {
    showLocationOffAlertSpy.mockRestore();
    getInProgressOrdersSpy.mockRestore();
    getUserSpy.mockRestore();
  });

  it('sets rider Offline and shows alert when Online with no job and no location permission', async () => {
    jest.spyOn(permissionsUtil, 'isLocationGranted').mockResolvedValue(false);
    mockRequestLocationPermission.mockResolvedValue(false);
    getInProgressOrdersSpy.mockResolvedValue([]);

    renderHook(() => useOfflineWithoutLocation(onlineUser));

    await waitFor(() => {
      expect(mockUpdateStatus).toHaveBeenCalledWith(UserStatus.Offline);
      expect(showLocationOffAlertSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('right after markJustLoggedIn, the first check does not run; returning to front afterwards does check (Clause 7)', async () => {
    jest.spyOn(permissionsUtil, 'isLocationGranted').mockResolvedValue(false);
    mockRequestLocationPermission.mockResolvedValue(false);
    getInProgressOrdersSpy.mockResolvedValue([]);

    // Rider just logged in: skip first check
    afterLogin.markJustLoggedIn();

    renderHook(() => useOfflineWithoutLocation(onlineUser));

    await act(async () => {});

    // First check skipped: no getUser, no updateStatus, no alert
    expect(getUserSpy).not.toHaveBeenCalled();
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(showLocationOffAlertSpy).not.toHaveBeenCalled();

    // Now rider backgrounds and returns to front: check DOES run
    await act(async () => {
      appStateListener?.('active');
    });

    await waitFor(() => {
      expect(getUserSpy).toHaveBeenCalledTimes(1);
      expect(mockUpdateStatus).toHaveBeenCalledWith(UserStatus.Offline);
      expect(showLocationOffAlertSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('with the server saying Offline (getUser), nothing happens even if cached user says Online (Clause 7)', async () => {
    jest.spyOn(permissionsUtil, 'isLocationGranted').mockResolvedValue(false);
    mockRequestLocationPermission.mockResolvedValue(false);
    // Server status is Offline
    getUserSpy.mockResolvedValue({
      id: 'courier-1',
      status: UserStatus.Offline,
    });

    renderHook(() => useOfflineWithoutLocation(onlineUser));

    await act(async () => {});

    expect(getUserSpy).toHaveBeenCalledTimes(1);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(showLocationOffAlertSpy).not.toHaveBeenCalled();
  });

  it('a failing getInProgressOrders leaves the rider as they are (Clause 7)', async () => {
    jest.spyOn(permissionsUtil, 'isLocationGranted').mockResolvedValue(false);
    mockRequestLocationPermission.mockResolvedValue(false);
    getInProgressOrdersSpy.mockRejectedValue(new Error('Network error'));

    renderHook(() => useOfflineWithoutLocation(onlineUser));

    await act(async () => {});

    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(showLocationOffAlertSpy).not.toHaveBeenCalled();
  });

  it('does NOT set rider Offline when rider holds an in-progress job', async () => {
    jest.spyOn(permissionsUtil, 'isLocationGranted').mockResolvedValue(false);
    mockRequestLocationPermission.mockResolvedValue(false);
    getInProgressOrdersSpy.mockResolvedValue([{ id: 'job-1' } as any]);

    renderHook(() => useOfflineWithoutLocation(onlineUser));

    await act(async () => {});

    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(showLocationOffAlertSpy).not.toHaveBeenCalled();
  });

  it('does NOT set rider Offline when location permission is granted', async () => {
    jest.spyOn(permissionsUtil, 'isLocationGranted').mockResolvedValue(true);
    getInProgressOrdersSpy.mockResolvedValue([]);

    renderHook(() => useOfflineWithoutLocation(onlineUser));

    await act(async () => {});

    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(showLocationOffAlertSpy).not.toHaveBeenCalled();
  });

  it('triggers check and sets Offline when returning to active foreground', async () => {
    // Initially granted
    jest
      .spyOn(permissionsUtil, 'isLocationGranted')
      .mockResolvedValueOnce(true);
    renderHook(() => useOfflineWithoutLocation(onlineUser));

    await act(async () => {});
    expect(mockUpdateStatus).not.toHaveBeenCalled();

    // Now permission revoked in settings, rider returns to app
    jest.spyOn(permissionsUtil, 'isLocationGranted').mockResolvedValue(false);
    mockRequestLocationPermission.mockResolvedValue(false);
    getInProgressOrdersSpy.mockResolvedValue([]);

    await act(async () => {
      appStateListener?.('active');
    });

    await waitFor(() => {
      expect(mockUpdateStatus).toHaveBeenCalledWith(UserStatus.Offline);
      expect(showLocationOffAlertSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('does nothing when rider is already Offline', async () => {
    const offlineUser: User = {
      id: 'courier-1',
      status: UserStatus.Offline,
    } as any;

    jest.spyOn(permissionsUtil, 'isLocationGranted').mockResolvedValue(false);
    mockRequestLocationPermission.mockResolvedValue(false);

    renderHook(() => useOfflineWithoutLocation(offlineUser));

    await act(async () => {});

    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(showLocationOffAlertSpy).not.toHaveBeenCalled();
  });
});

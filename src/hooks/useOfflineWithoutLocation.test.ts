import { AppState, AppStateStatus } from 'react-native';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useOfflineWithoutLocation } from './useOfflineWithoutLocation';
import { User, UserStatus } from '@app/types/types';
import * as permissionsUtil from '@app/utilities/permissions';
import * as locationForOnline from '@app/services/locationForOnline';
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

describe('useOfflineWithoutLocation (spec 0039, AC-16)', () => {
  let showLocationOffAlertSpy: jest.SpyInstance;
  let getInProgressOrdersSpy: jest.SpyInstance;
  let appStateListener: ((state: AppStateStatus) => void) | undefined;

  const onlineUser: User = {
    id: 'courier-1',
    status: UserStatus.Online,
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    showLocationOffAlertSpy = jest
      .spyOn(locationForOnline, 'showLocationOffAlert')
      .mockImplementation(() => {});
    getInProgressOrdersSpy = jest
      .spyOn(services.orderService, 'getInProgressOrders')
      .mockResolvedValue([]);

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

  it('does NOT set rider Offline when rider holds an in-progress job', async () => {
    jest.spyOn(permissionsUtil, 'isLocationGranted').mockResolvedValue(false);
    mockRequestLocationPermission.mockResolvedValue(false);
    getInProgressOrdersSpy.mockResolvedValue([{ id: 'job-1' } as any]);

    renderHook(() => useOfflineWithoutLocation(onlineUser));

    // Wait a tick for async checks to complete
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

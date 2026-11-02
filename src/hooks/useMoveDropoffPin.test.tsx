import React from 'react';
import { Alert } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import Geolocation from 'react-native-geolocation-service';
import { services } from '@app/services/service';
import { Order } from '@app/types/types';
import { OrderStatus } from '@app/types/enums';
import { QueryKeys } from '@app/utilities/queryKeys';
import {
  useMoveDropoffPin,
  formatPinDistance,
  isPreciseEnough,
  PIN_MAX_ACCURACY_METRES,
  PIN_FIX_TIMEOUT_MS,
} from './useMoveDropoffPin';
import '@app/localization/i18n';

describe('useMoveDropoffPin (spec 0016, AC-8)', () => {
  let queryClient: QueryClient;
  let invalidateSpy: jest.SpyInstance;
  let alertSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let moveDropoffPinSpy: jest.SpyInstance;

  const mockOrder: Order = {
    id: 'order-move-123',
    status: OrderStatus.courier_arrived_at_dropoff_location,
    dropoffName: 'Customer Alpha',
    dropoffFloor: '3',
    dropoffDoorbell: 'Papadopoulou',
    dropoffPointCorrectedAt: null,
  } as unknown as Order;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert');
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    moveDropoffPinSpy = jest.spyOn(services.orderService, 'moveDropoffPin');
  });

  afterEach(() => {
    alertSpy.mockRestore();
    consoleLogSpy.mockRestore();
    moveDropoffPinSpy.mockRestore();
  });

  describe('formatPinDistance', () => {
    it('formats distances strictly: metres under 1 km, km with one decimal at 1000 and above', () => {
      expect(formatPinDistance(30)).toBe('30 m');
      expect(formatPinDistance(141)).toBe('141 m');
      expect(formatPinDistance(999)).toBe('999 m');
      expect(formatPinDistance(999.4)).toBe('999 m');
      expect(formatPinDistance(1000)).toBe('1.0 km');
      expect(formatPinDistance(1200)).toBe('1.2 km');
      expect(formatPinDistance(1540)).toBe('1.5 km');
      expect(formatPinDistance(0)).toBe('0 m');
    });
  });

  describe('isPreciseEnough', () => {
    it('accepts positive finite accuracy up to PIN_MAX_ACCURACY_METRES (50 m)', () => {
      expect(PIN_MAX_ACCURACY_METRES).toBe(50);
      expect(isPreciseEnough(50)).toBe(true);
      expect(isPreciseEnough(49.9)).toBe(true);
      expect(isPreciseEnough(1)).toBe(true);
      expect(isPreciseEnough(15)).toBe(true);
    });

    it('refuses accuracy over 50 m', () => {
      expect(isPreciseEnough(50.1)).toBe(false);
      expect(isPreciseEnough(51)).toBe(false);
      expect(isPreciseEnough(100)).toBe(false);
    });

    it('refuses 0, negative, NaN and non-finite accuracy values', () => {
      expect(isPreciseEnough(0)).toBe(false);
      expect(isPreciseEnough(-1)).toBe(false);
      expect(isPreciseEnough(-50)).toBe(false);
      expect(isPreciseEnough(NaN)).toBe(false);
      expect(isPreciseEnough(Infinity)).toBe(false);
      expect(isPreciseEnough(-Infinity)).toBe(false);
    });
  });

  describe('useMoveDropoffPin workflow', () => {
    it('the first tap only asks (Alert with Cancel and Move pin) and reads no location; Cancel does nothing', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useMoveDropoffPin(), { wrapper });

      act(() => {
        result.current.movePin(mockOrder);
      });

      expect(alertSpy).toHaveBeenCalledTimes(1);
      const [title, body, buttons] = alertSpy.mock.calls[0];
      expect(title).toBe('Move the pin');
      expect(body).toBe(
        "Move the customer's pin to where you stand now? The restaurant's saved customer is updated for next time.",
      );
      expect(buttons).toHaveLength(2);
      expect(buttons[0]).toEqual({ text: 'Cancel', style: 'cancel' });
      expect(buttons[1].text).toBe('Move pin');
      expect(typeof buttons[1].onPress).toBe('function');

      // GPS location was NOT read on initial tap
      expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
      expect(moveDropoffPinSpy).not.toHaveBeenCalled();

      // Cancel button does nothing
      if (buttons[0].onPress) {
        act(() => {
          buttons[0].onPress();
        });
      }
      expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
      expect(moveDropoffPinSpy).not.toHaveBeenCalled();
    });

    it('Move pin reads getCurrentPosition with enableHighAccuracy true, timeout 15000, maximumAge 0', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useMoveDropoffPin(), { wrapper });

      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        (_success, error) => {
          error(new Error('GPS timeout'));
        },
      );

      act(() => {
        result.current.movePin(mockOrder);
      });

      const buttons = alertSpy.mock.calls[0][2];
      await act(async () => {
        buttons[1].onPress();
      });

      expect(PIN_FIX_TIMEOUT_MS).toBe(15000);
      expect(Geolocation.getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        },
      );
    });

    it('refuses a failed fix with "Could not read your location. Try again."', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useMoveDropoffPin(), { wrapper });

      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        (_success, error) => {
          error(new Error('GPS unavailable'));
        },
      );

      act(() => {
        result.current.movePin(mockOrder);
      });

      const buttons = alertSpy.mock.calls[0][2];
      await act(async () => {
        buttons[1].onPress();
      });

      expect(alertSpy).toHaveBeenCalledTimes(2);
      expect(alertSpy).toHaveBeenLastCalledWith(
        'Move the pin',
        'Could not read your location. Try again.',
      );
      expect(moveDropoffPinSpy).not.toHaveBeenCalled();
      expect(result.current.movingId).toBeNull();
    });

    it.each([
      ['accuracy over 50 m', 51],
      ['accuracy 0 (Android unknown)', 0],
      ['negative accuracy (iOS invalid)', -5],
      ['NaN accuracy', NaN],
    ])(
      'refuses %s with "Your location is not precise enough here. Step outside and try again." and makes no request',
      async (_, accuracy) => {
        const wrapper = createWrapper();
        const { result } = renderHook(() => useMoveDropoffPin(), { wrapper });

        (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
          success => {
            success({
              coords: {
                latitude: 39.3622,
                longitude: 22.9425,
                accuracy,
              },
            });
          },
        );

        act(() => {
          result.current.movePin(mockOrder);
        });

        const buttons = alertSpy.mock.calls[0][2];
        await act(async () => {
          buttons[1].onPress();
        });

        expect(alertSpy).toHaveBeenCalledTimes(2);
        expect(alertSpy).toHaveBeenLastCalledWith(
          'Move the pin',
          'Your location is not precise enough here. Step outside and try again.',
        );
        expect(moveDropoffPinSpy).not.toHaveBeenCalled();
        expect(result.current.movingId).toBeNull();
      },
    );

    it('accepts a fix with accuracy exactly 50 m and posts to deliveries/:id/dropoff-point', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useMoveDropoffPin(), { wrapper });

      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        success => {
          success({
            coords: {
              latitude: 39.3622,
              longitude: 22.9425,
              accuracy: 50,
            },
          });
        },
      );

      moveDropoffPinSpy.mockResolvedValue({
        savedCustomerUpdated: true,
        distanceMetres: 50,
      });

      act(() => {
        result.current.movePin(mockOrder);
      });

      const buttons = alertSpy.mock.calls[0][2];
      await act(async () => {
        buttons[1].onPress();
      });

      expect(moveDropoffPinSpy).toHaveBeenCalledTimes(1);
      expect(moveDropoffPinSpy).toHaveBeenCalledWith({
        id: mockOrder.id,
        latitude: 39.3622,
        longitude: 22.9425,
      });
      expect(alertSpy).toHaveBeenLastCalledWith(
        'Move the pin',
        'Pin moved 50 m. Thank you.',
      );
    });

    it.each([
      ['141 m', 141],
      ['999 m', 999],
      ['1.0 km', 1000],
      ['30 m', 30],
    ])(
      'success posts { latitude, longitude } and shows "Pin moved %s. Thank you." (metres: %i)',
      async (formatted, distanceMetres) => {
        const wrapper = createWrapper();
        const { result } = renderHook(() => useMoveDropoffPin(), { wrapper });

        (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
          success => {
            success({
              coords: {
                latitude: 39.3622,
                longitude: 22.9425,
                accuracy: 20,
              },
            });
          },
        );

        moveDropoffPinSpy.mockResolvedValue({
          savedCustomerUpdated: true,
          distanceMetres,
        });

        act(() => {
          result.current.movePin(mockOrder);
        });

        const buttons = alertSpy.mock.calls[0][2];
        await act(async () => {
          buttons[1].onPress();
        });

        expect(moveDropoffPinSpy).toHaveBeenCalledWith({
          id: mockOrder.id,
          latitude: 39.3622,
          longitude: 22.9425,
        });
        expect(alertSpy).toHaveBeenLastCalledWith(
          'Move the pin',
          `Pin moved ${formatted}. Thank you.`,
        );
        // Query cache is invalidated after success
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: [QueryKeys.inProgressOrders],
        });
        expect(result.current.movingId).toBeNull();
      },
    );

    it('shows "No connection. Try again when you have signal." for axios error with no response, and invalidates query', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useMoveDropoffPin(), { wrapper });

      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        success => {
          success({
            coords: {
              latitude: 39.3622,
              longitude: 22.9425,
              accuracy: 10,
            },
          });
        },
      );

      const networkError = new AxiosError('Network Error');
      networkError.response = undefined;
      moveDropoffPinSpy.mockRejectedValue(networkError);

      act(() => {
        result.current.movePin(mockOrder);
      });

      const buttons = alertSpy.mock.calls[0][2];
      await act(async () => {
        buttons[1].onPress();
      });

      expect(alertSpy).toHaveBeenLastCalledWith(
        'Move the pin',
        'No connection. Try again when you have signal.',
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });
      expect(result.current.movingId).toBeNull();
    });

    it('shows server message when axios error has 4xx response with result[0].message, and invalidates query', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useMoveDropoffPin(), { wrapper });

      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        success => {
          success({
            coords: {
              latitude: 39.3622,
              longitude: 22.9425,
              accuracy: 10,
            },
          });
        },
      );

      const conflictError = new AxiosError('Conflict');
      conflictError.response = {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: {} as any,
        data: {
          result: [
            {
              code: 'PIN_ALREADY_MOVED',
              message: 'The pin is already where you stand',
              statusCode: 409,
            },
          ],
        },
      };
      moveDropoffPinSpy.mockRejectedValue(conflictError);

      act(() => {
        result.current.movePin(mockOrder);
      });

      const buttons = alertSpy.mock.calls[0][2];
      await act(async () => {
        buttons[1].onPress();
      });

      expect(alertSpy).toHaveBeenLastCalledWith(
        'Move the pin',
        'The pin is already where you stand',
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });
      expect(result.current.movingId).toBeNull();
    });

    it('shows "Could not move the pin. Try again." when 4xx response has no message string', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useMoveDropoffPin(), { wrapper });

      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        success => {
          success({
            coords: {
              latitude: 39.3622,
              longitude: 22.9425,
              accuracy: 10,
            },
          });
        },
      );

      const badReqError = new AxiosError('Bad Request');
      badReqError.response = {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {} as any,
        data: {
          result: [{ message: ['latitude must be a number'] }], // array instead of string
        },
      };
      moveDropoffPinSpy.mockRejectedValue(badReqError);

      act(() => {
        result.current.movePin(mockOrder);
      });

      const buttons = alertSpy.mock.calls[0][2];
      await act(async () => {
        buttons[1].onPress();
      });

      expect(alertSpy).toHaveBeenLastCalledWith(
        'Move the pin',
        'Could not move the pin. Try again.',
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });
    });

    it('shows "Could not move the pin. Try again." for any 5xx error even if response contains a message', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useMoveDropoffPin(), { wrapper });

      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        success => {
          success({
            coords: {
              latitude: 39.3622,
              longitude: 22.9425,
              accuracy: 10,
            },
          });
        },
      );

      const serverFaultError = new AxiosError('Internal Server Error');
      serverFaultError.response = {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config: {} as any,
        data: {
          result: [
            {
              message: 'Internal server error: DB transaction failed',
              statusCode: 500,
            },
          ],
        },
      };
      moveDropoffPinSpy.mockRejectedValue(serverFaultError);

      act(() => {
        result.current.movePin(mockOrder);
      });

      const buttons = alertSpy.mock.calls[0][2];
      await act(async () => {
        buttons[1].onPress();
      });

      // Spec 0016 AC-8 & ruling: 5xx text is NEVER shown to the rider
      expect(alertSpy).toHaveBeenLastCalledWith(
        'Move the pin',
        'Could not move the pin. Try again.',
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: [QueryKeys.inProgressOrders],
      });
    });

    it('a second tap while one move runs does nothing', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useMoveDropoffPin(), { wrapper });

      let finishGps: (pos: any) => void = () => {};
      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        success => {
          finishGps = success;
        },
      );
      moveDropoffPinSpy.mockResolvedValue({
        savedCustomerUpdated: true,
        distanceMetres: 30,
      });

      // 1. First tap opens confirmation dialog
      act(() => {
        result.current.movePin(mockOrder);
      });
      expect(alertSpy).toHaveBeenCalledTimes(1);

      const buttons = alertSpy.mock.calls[0][2];
      // 2. Rider confirms: send starts and sets movingId
      act(() => {
        buttons[1].onPress();
      });
      expect(result.current.movingId).toBe(mockOrder.id);

      // 3. Second tap while movingId is set is ignored
      act(() => {
        result.current.movePin(mockOrder);
      });
      // Alert was not called a second time
      expect(alertSpy).toHaveBeenCalledTimes(1);

      // Finish the in-flight move
      await act(async () => {
        finishGps({
          coords: { latitude: 39.3622, longitude: 22.9425, accuracy: 25 },
        });
      });
      expect(result.current.movingId).toBeNull();
    });

    it('two Move pin presses in the same instant send only one request', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useMoveDropoffPin(), { wrapper });

      const gpsCallbacks: Array<(pos: any) => void> = [];
      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        success => {
          gpsCallbacks.push(success);
        },
      );
      moveDropoffPinSpy.mockResolvedValue({
        savedCustomerUpdated: true,
        distanceMetres: 40,
      });

      act(() => {
        result.current.movePin(mockOrder);
      });

      const buttons = alertSpy.mock.calls[0][2];
      const confirmOnPress = buttons[1].onPress;

      // Rider taps confirm twice in the same microtask (e.g. fast double-tap on dialog)
      act(() => {
        confirmOnPress();
        confirmOnPress();
      });

      // Complete any triggered GPS reads
      await act(async () => {
        for (const cb of gpsCallbacks) {
          cb({
            coords: { latitude: 39.3622, longitude: 22.9425, accuracy: 20 },
          });
        }
      });

      // Only one request was sent due to sendingRef.current guard
      expect(moveDropoffPinSpy).toHaveBeenCalledTimes(1);
    });

    it('no console log contains the rider token or coordinates', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useMoveDropoffPin(), { wrapper });

      const testLat = 39.362211;
      const testLon = 22.942533;
      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
        success => {
          success({
            coords: {
              latitude: testLat,
              longitude: testLon,
              accuracy: 10,
            },
          });
        },
      );

      // Axios error containing sensitive auth token in headers and coords in config
      const mockError = new AxiosError('Request failed with status code 401');
      const errorConfig = {
        headers: { Authorization: 'Bearer secret-rider-token-xyz' },
        data: { latitude: testLat, longitude: testLon },
      } as any;
      mockError.config = errorConfig;
      mockError.response = {
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config: errorConfig,
        data: {
          result: [{ message: 'Unauthorized' }],
        },
      } as any;
      moveDropoffPinSpy.mockRejectedValue(mockError);

      act(() => {
        result.current.movePin(mockOrder);
      });

      const buttons = alertSpy.mock.calls[0][2];
      await act(async () => {
        buttons[1].onPress();
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      for (const callArgs of consoleLogSpy.mock.calls) {
        const loggedText = callArgs.map((a: unknown) => String(a)).join(' ');
        expect(loggedText).not.toContain('secret-rider-token-xyz');
        expect(loggedText).not.toContain(String(testLat));
        expect(loggedText).not.toContain(String(testLon));
      }
    });
  });
});

import userService from './userService';
import { UClient } from './Client';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('userService (spec 0002, M5 & Row 66 Clause 3)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('calls client.patch with uppercase status and no timeout when options are omitted', async () => {
    const mockPatch = jest.fn().mockResolvedValue({ data: {} });
    const client = { patch: mockPatch } as unknown as UClient;
    const service = userService(client);

    await service.setUserStatus('offline');

    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch).toHaveBeenCalledWith(
      'courier/status',
      { status: 'OFFLINE' },
      { timeout: undefined },
    );
  });

  it('passes timeoutMs option to client.patch when specified (M5: LOGOUT_OFFLINE_TIMEOUT_MS)', async () => {
    const mockPatch = jest.fn().mockResolvedValue({ data: {} });
    const client = { patch: mockPatch } as unknown as UClient;
    const service = userService(client);

    await service.setUserStatus('offline', { timeoutMs: 3000 });

    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch).toHaveBeenCalledWith(
      'courier/status',
      { status: 'OFFLINE' },
      { timeout: 3000 },
    );
  });

  it('login saves BOTH accessToken and refreshToken in AsyncStorage and sets Authorization header (Row 66)', async () => {
    const mockPost = jest.fn().mockResolvedValue({
      data: {
        result: {
          session: {
            accessToken: 'login-access-token',
            refreshToken: 'login-refresh-token',
            tokenType: 'Bearer',
            expiresIn: 3600,
          },
        },
      },
    });

    const client = {
      post: mockPost,
      defaults: {
        headers: {
          common: {},
        },
      },
    } as unknown as UClient;

    const service = userService(client);
    const result = await service.login({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(mockPost).toHaveBeenCalledWith('auth/login', {
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.result.session.accessToken).toBe('login-access-token');

    // Both tokens saved in AsyncStorage
    expect(await AsyncStorage.getItem('token')).toBe('login-access-token');
    expect(await AsyncStorage.getItem('refreshToken')).toBe(
      'login-refresh-token',
    );

    // Authorization header set on client
    expect(client.defaults.headers.common.Authorization).toBe(
      'Bearer login-access-token',
    );
  });

  it('userService has no signup property and no service method calls auth/register across login and other methods (spec 0013 AC-7)', async () => {
    const mockPost = jest.fn().mockResolvedValue({
      data: {
        result: {
          session: {
            accessToken: 'test-access-token',
            refreshToken: 'test-refresh-token',
            tokenType: 'Bearer',
            expiresIn: 3600,
          },
        },
      },
    });
    const mockGet = jest.fn().mockImplementation((url: string) => {
      if (url === 'auth/me') {
        return Promise.resolve({
          data: {
            result: {
              email: 'rider@example.com',
              role: 'COURIER',
              courier: { id: 'c1', firstName: 'Rider', lastName: 'One' },
            },
          },
        });
      }
      return Promise.resolve({ data: { result: {} } });
    });
    const mockPatch = jest.fn().mockResolvedValue({ data: { result: {} } });

    const client = {
      post: mockPost,
      get: mockGet,
      patch: mockPatch,
      defaults: {
        headers: {
          common: {},
        },
      },
    } as unknown as UClient;

    const service = userService(client);

    // Spec 0013 AC-7: The service object has no signup property
    expect((service as any).signup).toBeUndefined();
    expect('signup' in service).toBe(false);

    // Exercise all service methods across login and the other methods
    await service.login({
      email: 'rider@example.com',
      password: 'password123',
    });
    await service.getUser();
    await service.getUserSettings();
    await service.updateUserSettings({ vehicleType: 'moped' });
    await service.setUserStatus('offline');
    await service.setDeliverySettings('manual');
    await service.setUserLocation({ latitude: 39.36, longitude: 22.94 });

    // mockPost was called with auth/login, and non-vacuously not called with auth/register
    expect(mockPost).toHaveBeenCalledWith('auth/login', {
      email: 'rider@example.com',
      password: 'password123',
    });
    expect(mockPost).not.toHaveBeenCalledWith(
      expect.stringContaining('auth/register'),
      expect.anything(),
    );

    // No client mock call across all service methods ever uses auth/register
    const allCalledEndpoints = [
      ...mockPost.mock.calls.map(call => call[0]),
      ...mockGet.mock.calls.map(call => call[0]),
      ...mockPatch.mock.calls.map(call => call[0]),
    ];
    for (const endpoint of allCalledEndpoints) {
      expect(endpoint).not.toContain('auth/register');
    }
  });

  it('login propagates rejection and does not save tokens when client.post rejects (failure case)', async () => {
    const mockPost = jest
      .fn()
      .mockRejectedValue(new Error('Invalid email or password'));
    const client = {
      post: mockPost,
      defaults: {
        headers: {
          common: {},
        },
      },
    } as unknown as UClient;

    const service = userService(client);
    await expect(
      service.login({
        email: 'rider@example.com',
        password: 'wrongpassword',
      }),
    ).rejects.toThrow('Invalid email or password');

    // AsyncStorage does not save any token on failure
    expect(await AsyncStorage.getItem('token')).toBeNull();
    expect(await AsyncStorage.getItem('refreshToken')).toBeNull();
  });
});

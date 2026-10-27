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

  it('signup saves BOTH accessToken and refreshToken in AsyncStorage and sets Authorization header (Row 66)', async () => {
    const mockPost = jest.fn().mockResolvedValue({
      data: {
        result: {
          session: {
            accessToken: 'signup-access-token',
            refreshToken: 'signup-refresh-token',
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
    const signupParams = {
      email: 'new@example.com',
      password: 'password123',
      firstName: 'New',
      lastName: 'Rider',
      phone: '1234567890',
    };
    const result = await service.signup(signupParams as any);

    expect(mockPost).toHaveBeenCalledWith('auth/register', signupParams);
    expect(result.result.session.accessToken).toBe('signup-access-token');

    // Both tokens saved in AsyncStorage
    expect(await AsyncStorage.getItem('token')).toBe('signup-access-token');
    expect(await AsyncStorage.getItem('refreshToken')).toBe(
      'signup-refresh-token',
    );

    // Authorization header set on client
    expect(client.defaults.headers.common.Authorization).toBe(
      'Bearer signup-access-token',
    );
  });
});

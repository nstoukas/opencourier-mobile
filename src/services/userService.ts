import { DeliveryType, User, UserResponse } from '@app/types/types';
import { UClient } from './Client';
import {
  LoginParams,
  UserServiceResponse,
  LoginResponse,
  UserSettings,
} from './types';
import { saveSession } from './session';

export interface UserService {
  login: (params: LoginParams) => Promise<LoginResponse>;
  getUser: () => Promise<User>;
  getUserSettings: () => Promise<UserSettings>;
  // Resolves with the raw PATCH response; the only caller (useUserSettings) ignores it
  // and refetches the settings instead.
  updateUserSettings: (
    params: Partial<UserSettings>,
  ) => Promise<UserServiceResponse>;
  // `options.timeoutMs` replaces the client's usual 10 s wait, for a call
  // that must not hold the rider up (logging out, spec 0002).
  setUserStatus: (
    status: string,
    options?: { timeoutMs?: number },
  ) => Promise<any>;
  setDeliverySettings: (settings: string) => Promise<any>;
  setUserLocation: (params: {
    latitude: number;
    longitude: number;
  }) => Promise<any>;
}

const userService = (client: UClient): UserService => {
  const login = async (params: LoginParams): Promise<LoginResponse> => {
    const { data } = await client.post<LoginResponse>('auth/login', params);
    const { accessToken, refreshToken } = data.result.session;
    // Both tokens: the refresh token renews the login when it expires (row 66).
    await saveSession(accessToken, refreshToken, client);
    return data;
  };

  const getUser = async (): Promise<User> => {
    const { data } = await client.get<UserResponse>('auth/me');
    const { email, courier, role } = data.result;
    const user = { email, role, ...courier };
    return user;
  };

  const setUserStatus = async (
    status: string,
    options?: { timeoutMs?: number },
  ): Promise<any> => {
    return client.patch(
      'courier/status',
      { status: status.toUpperCase() },
      // `?.` reads `timeoutMs` only if `options` was given; with no timeout
      // here axios keeps the client's own 10 s.
      { timeout: options?.timeoutMs },
    );
  };

  const setDeliverySettings = async (deliverySetting: string): Promise<any> => {
    return client.patch('courier/delivery-setting', { deliverySetting });
  };

  const getUserSettings = async (): Promise<UserSettings> => {
    const { data } = await client.get('courier-settings');
    return data.result;
  };

  const updateUserSettings = async (
    params: Partial<UserSettings>,
  ): Promise<UserServiceResponse> => {
    return client.patch('courier-settings', params);
  };

  const setUserLocation = async (params: {
    latitude: number;
    longitude: number;
  }) => {
    return client.patch('courier/location', params);
  };

  return {
    login,
    getUser,
    getUserSettings,
    updateUserSettings,
    setUserLocation,
    setUserStatus,
    setDeliverySettings,
  };
};

export default userService;

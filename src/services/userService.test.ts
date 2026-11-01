import fs from 'fs';
import path from 'path';
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

  it('userService has no signup method and never posts to auth/register (spec 0013 AC-7)', () => {
    const mockPost = jest.fn();
    const client = {
      post: mockPost,
      defaults: {
        headers: {
          common: {},
        },
      },
    } as unknown as UClient;

    const service = userService(client);

    // The co-op issues every rider's login from admin; mobile has no sign up (spec 0013, AC-7)
    expect((service as any).signup).toBeUndefined();
    expect(mockPost).not.toHaveBeenCalledWith(
      expect.stringContaining('auth/register'),
      expect.anything(),
    );
  });

  it('no file in src/services posts to or references auth/register (spec 0013 AC-7)', () => {
    const servicesDir = path.resolve(__dirname);

    const getSourceFiles = (dir: string): string[] => {
      const dirEntries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of dirEntries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...getSourceFiles(fullPath));
        } else if (
          (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
          !entry.name.endsWith('.test.ts') &&
          !entry.name.endsWith('.test.tsx')
        ) {
          files.push(fullPath);
        }
      }
      return files;
    };

    const sourceFiles = getSourceFiles(servicesDir);
    const violations: string[] = [];

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('auth/register')) {
        const relPath = path.relative(servicesDir, file);
        violations.push(`src/services/${relPath} references auth/register`);
      }
    }

    expect(violations).toEqual([]);
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { runUpgradeGate } from './upgradeGate';
import { apiUrl } from '@app/utilities/config';
import * as session from './session';
import * as jobStepOutbox from './jobStepOutbox';
import * as queryPersistence from './queryPersistence';
import { client } from './Client';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('Upgrade gate (spec 0039, AC-3)', () => {
  let alertSpy: jest.SpyInstance;
  let clientGetSpy: jest.SpyInstance;
  let clientPostSpy: jest.SpyInstance;
  let clearRiderDataSpy: jest.SpyInstance;
  let clearOutboxSpy: jest.SpyInstance;
  let clearSavedQueriesSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();

    alertSpy = jest.spyOn(Alert, 'alert');
    clientGetSpy = jest.spyOn(client, 'get').mockResolvedValue({} as any);
    clientPostSpy = jest.spyOn(client, 'post').mockResolvedValue({} as any);

    clearRiderDataSpy = jest.spyOn(session, 'clearRiderDataOnPhone');
    clearOutboxSpy = jest.spyOn(jobStepOutbox, 'clearOutbox');
    clearSavedQueriesSpy = jest.spyOn(queryPersistence, 'clearSavedQueries');
  });

  afterEach(() => {
    alertSpy.mockRestore();
    clientGetSpy.mockRestore();
    clientPostSpy.mockRestore();
    clearRiderDataSpy.mockRestore();
    clearOutboxSpy.mockRestore();
    clearSavedQueriesSpy.mockRestore();
  });

  it('stored BASE_URL differing from API_URL signs out locally with no network request and no alert', async () => {
    // Pre-populate storage with another server's address, user session, and outbox steps
    await AsyncStorage.setItem(
      'BASE_URL',
      'https://other-instance.example.com/api/courier/v1',
    );
    await AsyncStorage.setItem(
      'SOCKET_BASE_URL',
      'wss://other-instance.example.com',
    );
    await AsyncStorage.setItem('selected_org_key', 'some-org');
    await AsyncStorage.setItem('token', 'saved-courier-token');
    await AsyncStorage.setItem('refreshToken', 'saved-refresh-token');

    await runUpgradeGate();

    // Clears rider data on phone (tokens, saved queries) and outbox
    expect(clearRiderDataSpy).toHaveBeenCalledWith(client);
    expect(clearOutboxSpy).toHaveBeenCalledTimes(1);
    expect(clearSavedQueriesSpy).toHaveBeenCalledTimes(1);

    // Tokens must be removed from storage
    expect(await AsyncStorage.getItem('token')).toBeNull();
    expect(await AsyncStorage.getItem('refreshToken')).toBeNull();

    // No network requests to either server
    expect(clientGetSpy).not.toHaveBeenCalled();
    expect(clientPostSpy).not.toHaveBeenCalled();

    // No Alert dialog shown to the user
    expect(alertSpy).not.toHaveBeenCalled();

    // Old address keys are removed
    expect(await AsyncStorage.getItem('BASE_URL')).toBeNull();
    expect(await AsyncStorage.getItem('SOCKET_BASE_URL')).toBeNull();
    expect(await AsyncStorage.getItem('selected_org_key')).toBeNull();
  });

  it('matching BASE_URL (even with a trailing slash difference) clears nothing and removes old keys', async () => {
    // apiUrl with trailing slash
    const matchingUrlWithSlash = `${apiUrl}/`;
    await AsyncStorage.setItem('BASE_URL', matchingUrlWithSlash);
    await AsyncStorage.setItem('SOCKET_BASE_URL', 'ws://localhost:3000');
    await AsyncStorage.setItem('token', 'valid-courier-token');
    await AsyncStorage.setItem('refreshToken', 'valid-refresh-token');

    await runUpgradeGate();

    // Rider data and outbox are NOT cleared
    expect(clearRiderDataSpy).not.toHaveBeenCalled();
    expect(clearOutboxSpy).not.toHaveBeenCalled();
    expect(clearSavedQueriesSpy).not.toHaveBeenCalled();

    // Tokens remain untouched
    expect(await AsyncStorage.getItem('token')).toBe('valid-courier-token');
    expect(await AsyncStorage.getItem('refreshToken')).toBe(
      'valid-refresh-token',
    );

    // No alert and no network requests
    expect(alertSpy).not.toHaveBeenCalled();
    expect(clientGetSpy).not.toHaveBeenCalled();
    expect(clientPostSpy).not.toHaveBeenCalled();

    // Old keys are still cleaned up
    expect(await AsyncStorage.getItem('BASE_URL')).toBeNull();
    expect(await AsyncStorage.getItem('SOCKET_BASE_URL')).toBeNull();
  });

  it('no BASE_URL in storage clears nothing', async () => {
    await AsyncStorage.setItem('token', 'existing-token');

    await runUpgradeGate();

    expect(clearRiderDataSpy).not.toHaveBeenCalled();
    expect(clearOutboxSpy).not.toHaveBeenCalled();
    expect(clearSavedQueriesSpy).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('token')).toBe('existing-token');
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

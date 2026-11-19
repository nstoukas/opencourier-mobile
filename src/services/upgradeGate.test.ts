import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { runUpgradeGate } from './upgradeGate';
import { apiUrl } from '@app/utilities/config';
import * as session from './session';
import * as jobStepOutbox from './jobStepOutbox';
import * as queryPersistence from './queryPersistence';
import * as shiftReminder from './shifts/shiftReminder';
import { client } from './Client';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('Upgrade gate (spec 0039, AC-3, Clause 5)', () => {
  let alertSpy: jest.SpyInstance;
  let clientGetSpy: jest.SpyInstance;
  let clientPostSpy: jest.SpyInstance;
  let clearRiderDataSpy: jest.SpyInstance;
  let clearOutboxSpy: jest.SpyInstance;
  let clearSavedQueriesSpy: jest.SpyInstance;
  let syncShiftRemindersSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();

    alertSpy = jest.spyOn(Alert, 'alert');
    clientGetSpy = jest.spyOn(client, 'get').mockResolvedValue({} as any);
    clientPostSpy = jest.spyOn(client, 'post').mockResolvedValue({} as any);

    clearRiderDataSpy = jest.spyOn(session, 'clearRiderDataOnPhone');
    clearOutboxSpy = jest.spyOn(jobStepOutbox, 'clearOutbox');
    clearSavedQueriesSpy = jest.spyOn(queryPersistence, 'clearSavedQueries');
    syncShiftRemindersSpy = jest.spyOn(shiftReminder, 'syncShiftReminders');
  });

  afterEach(() => {
    alertSpy.mockRestore();
    clientGetSpy.mockRestore();
    clientPostSpy.mockRestore();
    clearRiderDataSpy.mockRestore();
    clearOutboxSpy.mockRestore();
    clearSavedQueriesSpy.mockRestore();
    syncShiftRemindersSpy.mockRestore();
  });

  it('stored BASE_URL differing from API_URL clears outbox first, removes other server keys, cancels shift reminders, clears login, and removes old keys', async () => {
    const callOrder: string[] = [];
    clearOutboxSpy.mockImplementation(async () => {
      callOrder.push('clearOutbox');
    });
    syncShiftRemindersSpy.mockImplementation(async () => {
      callOrder.push('syncShiftReminders');
    });
    clearRiderDataSpy.mockImplementation(async (_clientArg: any) => {
      callOrder.push('clearRiderDataOnPhone');
      await AsyncStorage.multiRemove(['token', 'refreshToken']);
    });

    // Pre-populate storage with another server's address, user session, and other server keys
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
    await AsyncStorage.setItem('sosByRider', '{"rider-1":{"points":[]}}');
    await AsyncStorage.setItem('heldArrivals', '[101]');
    await AsyncStorage.setItem('answered_offer_ids', '["offer-101"]');
    await AsyncStorage.setItem('cancelledJobsAlerted', '["job-202"]');

    await runUpgradeGate();

    // Call order: outbox must be cleared first
    expect(callOrder[0]).toBe('clearOutbox');
    expect(callOrder).toContain('syncShiftReminders');
    expect(callOrder).toContain('clearRiderDataOnPhone');
    expect(syncShiftRemindersSpy).toHaveBeenCalledWith([], 0);
    expect(clearRiderDataSpy).toHaveBeenCalledWith(client);

    // Tokens must be removed from storage
    expect(await AsyncStorage.getItem('token')).toBeNull();
    expect(await AsyncStorage.getItem('refreshToken')).toBeNull();

    // Other server keys must be removed
    expect(await AsyncStorage.getItem('sosByRider')).toBeNull();
    expect(await AsyncStorage.getItem('heldArrivals')).toBeNull();
    expect(await AsyncStorage.getItem('answered_offer_ids')).toBeNull();
    expect(await AsyncStorage.getItem('cancelledJobsAlerted')).toBeNull();

    // Old address keys are removed
    expect(await AsyncStorage.getItem('BASE_URL')).toBeNull();
    expect(await AsyncStorage.getItem('SOCKET_BASE_URL')).toBeNull();
    expect(await AsyncStorage.getItem('selected_org_key')).toBeNull();

    // No network requests to either server
    expect(clientGetSpy).not.toHaveBeenCalled();
    expect(clientPostSpy).not.toHaveBeenCalled();

    // No Alert dialog shown to the user
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('when one clear throws, the others still run and BASE_URL is NOT removed (retries next start)', async () => {
    // clearOutbox throws an error
    clearOutboxSpy.mockRejectedValue(new Error('Outbox storage error'));

    await AsyncStorage.setItem(
      'BASE_URL',
      'https://other-instance.example.com/api/courier/v1',
    );
    await AsyncStorage.setItem('token', 'saved-courier-token');
    await AsyncStorage.setItem('sosByRider', '{"rider-1":{"points":[]}}');
    await AsyncStorage.setItem('heldArrivals', '[101]');

    await runUpgradeGate();

    // Even though clearOutbox threw, the other clears still ran!
    expect(syncShiftRemindersSpy).toHaveBeenCalledWith([], 0);
    expect(clearRiderDataSpy).toHaveBeenCalledWith(client);
    expect(await AsyncStorage.getItem('sosByRider')).toBeNull();
    expect(await AsyncStorage.getItem('heldArrivals')).toBeNull();

    // Because a clear failed, BASE_URL is NOT removed so it will retry on next start
    expect(await AsyncStorage.getItem('BASE_URL')).toBe(
      'https://other-instance.example.com/api/courier/v1',
    );
  });

  it('when clearRiderData throws, the earlier clears ran and BASE_URL is NOT removed', async () => {
    clearRiderDataSpy.mockRejectedValue(new Error('Clear login error'));

    await AsyncStorage.setItem(
      'BASE_URL',
      'https://other-instance.example.com/api/courier/v1',
    );
    await AsyncStorage.setItem('sosByRider', '{"points":[]}');

    await runUpgradeGate();

    expect(clearOutboxSpy).toHaveBeenCalledTimes(1);
    expect(syncShiftRemindersSpy).toHaveBeenCalledWith([], 0);
    expect(await AsyncStorage.getItem('sosByRider')).toBeNull();

    // BASE_URL retained for retry
    expect(await AsyncStorage.getItem('BASE_URL')).toBe(
      'https://other-instance.example.com/api/courier/v1',
    );
  });

  it('matching BASE_URL (even with a trailing slash difference) clears nothing and removes old keys', async () => {
    // apiUrl with trailing slash
    const matchingUrlWithSlash = `${apiUrl}/`;
    await AsyncStorage.setItem('BASE_URL', matchingUrlWithSlash);
    await AsyncStorage.setItem('SOCKET_BASE_URL', 'ws://localhost:3000');
    await AsyncStorage.setItem('token', 'valid-courier-token');
    await AsyncStorage.setItem('refreshToken', 'valid-refresh-token');
    await AsyncStorage.setItem('sosByRider', '{"valid":"sos"}');
    await AsyncStorage.setItem('heldArrivals', '[1]');

    await runUpgradeGate();

    // Rider data, outbox, shift reminders and other server keys are NOT cleared
    expect(clearRiderDataSpy).not.toHaveBeenCalled();
    expect(clearOutboxSpy).not.toHaveBeenCalled();
    expect(syncShiftRemindersSpy).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('sosByRider')).toBe('{"valid":"sos"}');
    expect(await AsyncStorage.getItem('heldArrivals')).toBe('[1]');

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
    expect(syncShiftRemindersSpy).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('token')).toBe('existing-token');
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

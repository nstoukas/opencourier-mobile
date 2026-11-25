import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Socket } from 'socket.io-client';
import '@app/localization/i18n';
import { QueryKeys } from '@app/utilities/queryKeys';
import { JOB_EDITED_EVENT } from './liveConnection';
import {
  clearJobEditMarks,
  jobEditMarksFor,
} from './jobEdits/jobEditMarks';
import { showJobEditedNotice } from './readyNotice/readyNotice';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('./readyNotice/readyNotice', () => {
  const actual = jest.requireActual('./readyNotice/readyNotice');
  return {
    ...actual,
    showJobEditedNotice: jest.fn(() => Promise.resolve()),
  };
});

// Minimal FakeSocket stand-in for SocketProvider tests
class MockFakeSocket {
  connected = false;
  active = true;
  events = new Map<string, Array<(...args: any[]) => void>>();
  on(event: string, listener: (...args: any[]) => void) {
    const list = this.events.get(event) ?? [];
    list.push(listener);
    this.events.set(event, list);
    return this;
  }
  emit(event: string, ...args: any[]) {
    for (const listener of [...(this.events.get(event) ?? [])]) {
      listener(...args);
    }
  }
  connect() {}
  disconnect() {}
  removeAllListeners() {
    this.events.clear();
  }
}

let mockLatestSocket: MockFakeSocket | null = null;

jest.mock('./liveConnection', () => {
  const actual = jest.requireActual('./liveConnection');
  return {
    ...actual,
    createCourierSocket: () => {
      mockLatestSocket = new MockFakeSocket();
      return mockLatestSocket as unknown as Socket;
    },
  };
});

jest.mock('@app/hooks/useUser', () => () => ({
  user: { id: 'courier-1', status: 'ONLINE' },
  isLoading: false,
  refetchUser: jest.fn(),
}));

jest.mock('@app/services/service', () => ({
  services: {
    orderService: {
      getInProgressOrders: jest.fn(() => Promise.resolve([])),
    },
  },
}));

import SocketProvider from './socket';

// Row 164 (AC-1): the live JOB_EDITED event marks the job, posts one notice,
// and refetches only inProgressOrders.
describe('SocketProvider JOB_EDITED (row 164, AC-1)', () => {
  let queryClient: QueryClient;
  let invalidateSpy: jest.SpyInstance;
  let tree: renderer.ReactTestRenderer;

  const validMessage = {
    deliveryId: 'del-edit-1',
    restaurantName: 'R73 Kitchen',
    changed: ['NOTES', 'TIMES'],
    editedAt: '2026-11-25T14:30:00.000Z',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    clearJobEditMarks();
    mockLatestSocket = null;
    await AsyncStorage.setItem('token', 'courier-jwt-token');
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: Infinity },
      },
    });
    await act(async () => {
      tree = renderer.create(
        <QueryClientProvider client={queryClient}>
          <SocketProvider>{null}</SocketProvider>
        </QueryClientProvider>,
      );
    });
    expect(mockLatestSocket).not.toBeNull();
    invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
  });

  afterEach(() => {
    invalidateSpy.mockRestore();
    clearJobEditMarks();
  });

  it('valid JOB_EDITED event marks the job, shows a notice, and invalidates inProgressOrders only', async () => {
    await act(async () => {
      mockLatestSocket!.emit(JOB_EDITED_EVENT, validMessage);
    });

    // 1. Marks the job
    expect(jobEditMarksFor('del-edit-1')).toEqual(['NOTES', 'TIMES']);

    // 2. Shows the notice
    expect(showJobEditedNotice).toHaveBeenCalledTimes(1);
    expect(showJobEditedNotice).toHaveBeenCalledWith({
      deliveryId: 'del-edit-1',
      restaurantName: 'R73 Kitchen',
      changed: ['NOTES', 'TIMES'],
      editedAt: '2026-11-25T14:30:00.000Z',
    });

    // 3. Invalidates inProgressOrders only
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.inProgressOrders],
    });
  });

  it('malformed JOB_EDITED event does nothing: no marks, no notice, no invalidation', async () => {
    await act(async () => {
      mockLatestSocket!.emit(JOB_EDITED_EVENT, null);
      mockLatestSocket!.emit(JOB_EDITED_EVENT, { deliveryId: '' });
      mockLatestSocket!.emit(JOB_EDITED_EVENT, { deliveryId: 'del-x', changed: [] });
      mockLatestSocket!.emit(JOB_EDITED_EVENT, { deliveryId: 'del-x', changed: ['UNKNOWN'] });
    });

    expect(jobEditMarksFor('del-x')).toEqual([]);
    expect(showJobEditedNotice).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('a notice that rejects still invalidates inProgressOrders without throwing', async () => {
    (showJobEditedNotice as jest.Mock).mockRejectedValueOnce(
      new Error('notifee display failed'),
    );

    await act(async () => {
      mockLatestSocket!.emit(JOB_EDITED_EVENT, validMessage);
    });

    expect(jobEditMarksFor('del-edit-1')).toEqual(['NOTES', 'TIMES']);
    expect(showJobEditedNotice).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [QueryKeys.inProgressOrders],
    });
  });
});

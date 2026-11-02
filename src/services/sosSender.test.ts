import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SOS_NOT_ACTIVE_CODE,
  SosAnswer,
  SosIncident,
  SosPointToSend,
  SosService,
} from './sosService';
import {
  SOS_POINTS_PER_REQUEST,
  getLastSosOutcome,
  resetSosSenderForTests,
  sendSos,
  subscribeSosOutcome,
} from './sosSender';
import {
  addSosPoint,
  endSos,
  loadSosRecord,
  resetSosStoreForTests,
  startSos,
} from './sosStore';

describe('sosSender (spec 0022, AC-4, AC-5, AC-6)', () => {
  let mockApi: jest.Mocked<SosService>;
  const courierId = 'rider-1';

  beforeEach(async () => {
    resetSosStoreForTests();
    resetSosSenderForTests();
    await AsyncStorage.clear();

    mockApi = {
      start: jest.fn(),
      getActive: jest.fn(),
      sendPoints: jest.fn(),
      end: jest.fn(),
    };
  });

  describe('call sharing and login check', () => {
    it('shares a single round when sendSos is called twice while in flight', async () => {
      await startSos(courierId, { clientId: 'c1', heldAt: 1000 });
      let resolveStart!: (value: SosAnswer<SosIncident>) => void;
      mockApi.start.mockImplementation(
        () =>
          new Promise(resolve => {
            resolveStart = resolve;
          }),
      );

      const p1 = sendSos(courierId, mockApi, () => courierId);
      const p2 = sendSos(courierId, mockApi, () => courierId);

      expect(p1).toBe(p2);

      // Allow microtasks (loadSosRecord -> load -> AsyncStorage.getItem) to advance to api.start
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }
      expect(mockApi.start).toHaveBeenCalledTimes(1);

      resolveStart({
        kind: 'ok',
        result: {
          id: 'inc-1',
          state: 'ACTIVE',
          deliveryId: null,
          startedAt: '2026-11-03T00:00:00.000Z',
        },
      });

      const outcome = await p1;
      expect(outcome).toBe('idle');
    });

    it('stops before any request when another rider or nobody is logged in', async () => {
      await startSos(courierId, { clientId: 'c1', heldAt: 1000 });

      // Nobody logged in
      const outcomeNobody = await sendSos(courierId, mockApi, () => undefined);
      expect(outcomeNobody).toBe('idle');
      expect(mockApi.start).not.toHaveBeenCalled();

      // Another rider logged in
      const outcomeOther = await sendSos(
        courierId,
        mockApi,
        () => 'another-rider',
      );
      expect(outcomeOther).toBe('idle');
      expect(mockApi.start).not.toHaveBeenCalled();
    });
  });

  describe('start order, tapAgeMs, deliveryId and responses', () => {
    it('sends tapAgeMs = now - heldAt (never negative) and deliveryId when set', async () => {
      await startSos(courierId, {
        clientId: 'c1',
        heldAt: 5000,
        deliveryId: 'del-99',
      });

      mockApi.start.mockResolvedValueOnce({
        kind: 'ok',
        result: {
          id: 'inc-1',
          state: 'ACTIVE',
          deliveryId: 'del-99',
          startedAt: '2026-11-03T00:00:00.000Z',
        },
      });

      const outcome = await sendSos(
        courierId,
        mockApi,
        () => courierId,
        () => 8000, // now = 8000 -> tapAgeMs = 3000
      );

      expect(mockApi.start).toHaveBeenCalledWith({
        clientId: 'c1',
        tapAgeMs: 3000,
        deliveryId: 'del-99',
      });
      expect(outcome).toBe('idle');

      const record = await loadSosRecord(courierId);
      expect(record?.incidentId).toBe('inc-1');
    });

    it('sends tapAgeMs = 0 if clock is earlier than heldAt (never negative)', async () => {
      await startSos(courierId, { clientId: 'c1', heldAt: 10000 });

      mockApi.start.mockResolvedValueOnce({
        kind: 'ok',
        result: {
          id: 'inc-1',
          state: 'ACTIVE',
          deliveryId: null,
          startedAt: '2026-11-03T00:00:00.000Z',
        },
      });

      await sendSos(
        courierId,
        mockApi,
        () => courierId,
        () => 5000, // clock earlier than heldAt
      );

      expect(mockApi.start).toHaveBeenCalledWith({
        clientId: 'c1',
        tapAgeMs: 0,
      });
    });

    it('clears record and returns endedByCoop when start answer state is not ACTIVE and no end waits', async () => {
      await startSos(courierId, { clientId: 'c1', heldAt: 1000 });

      mockApi.start.mockResolvedValueOnce({
        kind: 'ok',
        result: {
          id: 'inc-closed',
          state: 'CLOSED',
          deliveryId: null,
          startedAt: '2026-11-03T00:00:00.000Z',
        },
      });

      const outcome = await sendSos(courierId, mockApi, () => courierId);

      expect(outcome).toBe('endedByCoop');
      const record = await loadSosRecord(courierId);
      expect(record).toBeUndefined();
    });

    it('drops deliveryId and retries start immediately when start errors with non-retry status and deliveryId was set', async () => {
      await startSos(courierId, {
        clientId: 'c1',
        heldAt: 1000,
        deliveryId: 'del-dead',
      });

      // 404 delivery not found
      mockApi.start
        .mockResolvedValueOnce({
          kind: 'error',
          httpStatus: 404,
          code: 'DELIVERY_NOT_FOUND',
        })
        .mockResolvedValueOnce({
          kind: 'ok',
          result: {
            id: 'inc-1',
            state: 'ACTIVE',
            deliveryId: null,
            startedAt: '2026-11-03T00:00:00.000Z',
          },
        });

      const outcome = await sendSos(courierId, mockApi, () => courierId);

      expect(mockApi.start).toHaveBeenCalledTimes(2);
      expect(mockApi.start).toHaveBeenNthCalledWith(1, {
        clientId: 'c1',
        tapAgeMs: expect.any(Number),
        deliveryId: 'del-dead',
      });
      expect(mockApi.start).toHaveBeenNthCalledWith(2, {
        clientId: 'c1',
        tapAgeMs: expect.any(Number),
      });
      expect(outcome).toBe('idle');
    });

    it('returns noSignal and drops nothing when start receives no answer (kind: none)', async () => {
      await startSos(courierId, { clientId: 'c1', heldAt: 1000 });
      mockApi.start.mockResolvedValueOnce({ kind: 'none' });

      const outcome = await sendSos(courierId, mockApi, () => courierId);

      expect(outcome).toBe('noSignal');
      expect(getLastSosOutcome()).toBe('noSignal');
      const record = await loadSosRecord(courierId);
      expect(record?.clientId).toBe('c1');
    });

    it('returns retry and keeps start when start receives 401, 408, 429, or 5xx', async () => {
      await startSos(courierId, { clientId: 'c1', heldAt: 1000 });

      for (const status of [401, 408, 429, 500, 503]) {
        mockApi.start.mockResolvedValueOnce({
          kind: 'error',
          httpStatus: status,
        });
        const outcome = await sendSos(courierId, mockApi, () => courierId);
        expect(outcome).toBe('retry');
        const record = await loadSosRecord(courierId);
        expect(record?.clientId).toBe('c1');
      }
    });
  });

  describe('execution order: start, points, end', () => {
    it('executes in exact sequence: start -> points -> end', async () => {
      await startSos(courierId, { clientId: 'c1', heldAt: 1000 });
      await addSosPoint(courierId, {
        latitude: 39.1,
        longitude: 22.1,
        accuracyMetres: 8,
        takenAt: 1200,
      });
      await endSos(courierId, { kind: 'safe', tappedAt: 2000 });

      const callOrder: string[] = [];
      mockApi.start.mockImplementation(async () => {
        callOrder.push('start');
        return {
          kind: 'ok',
          result: {
            id: 'inc-1',
            state: 'ACTIVE',
            deliveryId: null,
            startedAt: '2026-11-03T00:00:00.000Z',
          },
        };
      });
      mockApi.sendPoints.mockImplementation(async () => {
        callOrder.push('sendPoints');
        return { kind: 'ok', result: { accepted: 1 } };
      });
      mockApi.end.mockImplementation(async () => {
        callOrder.push('end');
        return {
          kind: 'ok',
          result: {
            id: 'inc-1',
            state: 'AWAITING_CLOSE',
            deliveryId: null,
            startedAt: '2026-11-03T00:00:00.000Z',
          },
        };
      });

      const outcome = await sendSos(
        courierId,
        mockApi,
        () => courierId,
        () => 3000,
      );

      expect(callOrder).toEqual(['start', 'sendPoints', 'end']);
      expect(outcome).toBe('ended');
      expect(await loadSosRecord(courierId)).toBeUndefined();
    });
  });

  describe('points batching, ageMs, accuracyMetres, and status handling', () => {
    it('sends points oldest first in batches of at most 120 with ageMs = sendTime - takenAt and accuracyMetres only when known', async () => {
      await startSos(courierId, { clientId: 'c1', heldAt: 1000 });
      // Simulate incident already started
      mockApi.start.mockResolvedValueOnce({
        kind: 'ok',
        result: {
          id: 'inc-1',
          state: 'ACTIVE',
          deliveryId: null,
          startedAt: '2026-11-03T00:00:00.000Z',
        },
      });

      // Add 125 points
      for (let i = 0; i < 125; i++) {
        await addSosPoint(courierId, {
          latitude: 39.0 + i * 0.001,
          longitude: 22.0,
          ...(i % 2 === 0 ? { accuracyMetres: 10 } : {}),
          takenAt: 1000 + i * 100,
        });
      }

      mockApi.sendPoints.mockResolvedValue({
        kind: 'ok',
        result: { accepted: 120 },
      });

      const outcome = await sendSos(
        courierId,
        mockApi,
        () => courierId,
        () => 20000, // now = 20000
      );

      expect(outcome).toBe('idle');
      expect(mockApi.sendPoints).toHaveBeenCalledTimes(2);

      // First call has 120 points (batch 1)
      const firstBatch: SosPointToSend[] = mockApi.sendPoints.mock.calls[0][1];
      expect(firstBatch.length).toBe(SOS_POINTS_PER_REQUEST);
      expect(firstBatch[0].latitude).toBeCloseTo(39.0);
      expect(firstBatch[0].accuracyMetres).toBe(10);
      expect(firstBatch[0].ageMs).toBe(20000 - 1000);
      expect(firstBatch[1].accuracyMetres).toBeUndefined(); // unknown accuracy omitted

      // Second call has remaining 5 points (batch 2)
      const secondBatch: SosPointToSend[] = mockApi.sendPoints.mock.calls[1][1];
      expect(secondBatch.length).toBe(5);
      expect(secondBatch[0].latitude).toBeCloseTo(39.0 + 120 * 0.001);

      // All points dropped after successful sends
      const record = await loadSosRecord(courierId);
      expect(record?.points).toEqual([]);
    });

    it('clears record and returns endedByCoop on 409 SOS_NOT_ACTIVE or 404 with no end waiting', async () => {
      await startSos(courierId, { clientId: 'c1', heldAt: 1000 });
      await addSosPoint(courierId, {
        latitude: 39.1,
        longitude: 22.1,
        takenAt: 1200,
      });

      mockApi.start.mockResolvedValueOnce({
        kind: 'ok',
        result: {
          id: 'inc-1',
          state: 'ACTIVE',
          deliveryId: null,
          startedAt: '2026-11-03T00:00:00.000Z',
        },
      });
      mockApi.sendPoints.mockResolvedValueOnce({
        kind: 'error',
        httpStatus: 409,
        code: SOS_NOT_ACTIVE_CODE,
      });

      const outcome = await sendSos(courierId, mockApi, () => courierId);

      expect(outcome).toBe('endedByCoop');
      expect(await loadSosRecord(courierId)).toBeUndefined();
    });

    it('drops waiting points and still sends end when 409 SOS_NOT_ACTIVE occurs with an end waiting', async () => {
      await startSos(courierId, { clientId: 'c1', heldAt: 1000 });
      await addSosPoint(courierId, {
        latitude: 39.1,
        longitude: 22.1,
        takenAt: 1200,
      });
      await endSos(courierId, { kind: 'safe', tappedAt: 1500 });

      mockApi.start.mockResolvedValueOnce({
        kind: 'ok',
        result: {
          id: 'inc-1',
          state: 'ACTIVE',
          deliveryId: null,
          startedAt: '2026-11-03T00:00:00.000Z',
        },
      });
      mockApi.sendPoints.mockResolvedValueOnce({
        kind: 'error',
        httpStatus: 409,
        code: SOS_NOT_ACTIVE_CODE,
      });
      mockApi.end.mockResolvedValueOnce({
        kind: 'ok',
        result: {
          id: 'inc-1',
          state: 'AWAITING_CLOSE',
          deliveryId: null,
          startedAt: '2026-11-03T00:00:00.000Z',
        },
      });

      const outcome = await sendSos(courierId, mockApi, () => courierId);

      expect(mockApi.end).toHaveBeenCalledTimes(1);
      expect(outcome).toBe('ended');
      expect(await loadSosRecord(courierId)).toBeUndefined();
    });

    it('drops that batch only on 400 error', async () => {
      await startSos(courierId, { clientId: 'c1', heldAt: 1000 });
      await addSosPoint(courierId, {
        latitude: 39.1,
        longitude: 22.1,
        takenAt: 1200,
      });

      mockApi.start.mockResolvedValueOnce({
        kind: 'ok',
        result: {
          id: 'inc-1',
          state: 'ACTIVE',
          deliveryId: null,
          startedAt: '2026-11-03T00:00:00.000Z',
        },
      });
      // 400 bad points batch
      mockApi.sendPoints.mockResolvedValueOnce({
        kind: 'error',
        httpStatus: 400,
      });

      const outcome = await sendSos(courierId, mockApi, () => courierId);

      expect(outcome).toBe('idle');
      const record = await loadSosRecord(courierId);
      // The 1 point in the batch was dropped
      expect(record?.points).toEqual([]);
    });

    it('returns noSignal and keeps points when sendPoints gets kind: none', async () => {
      await startSos(courierId, { clientId: 'c1', heldAt: 1000 });
      await addSosPoint(courierId, {
        latitude: 39.1,
        longitude: 22.1,
        takenAt: 1200,
      });

      mockApi.start.mockResolvedValueOnce({
        kind: 'ok',
        result: {
          id: 'inc-1',
          state: 'ACTIVE',
          deliveryId: null,
          startedAt: '2026-11-03T00:00:00.000Z',
        },
      });
      mockApi.sendPoints.mockResolvedValueOnce({ kind: 'none' });

      const outcome = await sendSos(courierId, mockApi, () => courierId);

      expect(outcome).toBe('noSignal');
      const record = await loadSosRecord(courierId);
      expect(record?.points.length).toBe(1);
    });
  });

  describe('end handling', () => {
    it('sends tapAgeMs = now - tappedAt on safe kind and clears record on ok, 409, or 404', async () => {
      for (const answer of [
        {
          kind: 'ok' as const,
          result: {
            id: 'inc-1',
            state: 'AWAITING_CLOSE' as const,
            deliveryId: null,
            startedAt: '2026-11-03T00:00:00.000Z',
          },
        },
        { kind: 'error' as const, httpStatus: 409 },
        { kind: 'error' as const, httpStatus: 404 },
      ]) {
        await startSos(courierId, { clientId: 'c1', heldAt: 1000 });
        await endSos(courierId, { kind: 'safe', tappedAt: 2000 });

        mockApi.start.mockResolvedValueOnce({
          kind: 'ok',
          result: {
            id: 'inc-1',
            state: 'ACTIVE',
            deliveryId: null,
            startedAt: '2026-11-03T00:00:00.000Z',
          },
        });
        mockApi.end.mockResolvedValueOnce(answer);

        const outcome = await sendSos(
          courierId,
          mockApi,
          () => courierId,
          () => 5000,
        );

        expect(mockApi.end).toHaveBeenCalledWith('inc-1', 'safe', 3000);
        expect(outcome).toBe('ended');
        expect(await loadSosRecord(courierId)).toBeUndefined();
      }
    });

    it('returns noSignal and keeps record when end receives no answer', async () => {
      await startSos(courierId, { clientId: 'c1', heldAt: 1000 });
      await endSos(courierId, { kind: 'falseAlarm', tappedAt: 2000 });

      mockApi.start.mockResolvedValueOnce({
        kind: 'ok',
        result: {
          id: 'inc-1',
          state: 'ACTIVE',
          deliveryId: null,
          startedAt: '2026-11-03T00:00:00.000Z',
        },
      });
      mockApi.end.mockResolvedValueOnce({ kind: 'none' });

      const outcome = await sendSos(courierId, mockApi, () => courierId);

      expect(outcome).toBe('noSignal');
      const record = await loadSosRecord(courierId);
      expect(record?.end?.kind).toBe('falseAlarm');
    });
  });

  describe('subscribeSosOutcome', () => {
    it('notifies listeners when lastOutcome changes', async () => {
      const listener = jest.fn();
      const unsubscribe = subscribeSosOutcome(listener);

      await startSos(courierId, { clientId: 'c1', heldAt: 1000 });
      mockApi.start.mockResolvedValueOnce({ kind: 'none' });

      await sendSos(courierId, mockApi, () => courierId);

      expect(listener).toHaveBeenCalled();
      expect(getLastSosOutcome()).toBe('noSignal');

      unsubscribe();
    });
  });
});

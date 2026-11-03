import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SOS_NOT_ACTIVE_CODE,
  SosAnswer,
  SosIncident,
  SosPointToSend,
  SosService,
} from './sosService';
import {
  SOS_MAX_AGE_MS,
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
  loadSosRecords,
  markSosStarted,
  resetSosStoreForTests,
  SOS_MAX_WAITING_POINTS,
  startSos,
} from './sosStore';

const incident = (
  id: string,
  state: SosIncident['state'] = 'ACTIVE',
): SosAnswer<SosIncident> => ({
  kind: 'ok',
  result: {
    id,
    state,
    deliveryId: null,
    startedAt: '2026-11-03T00:00:00.000Z',
  },
});

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

  // Row 73 review fix: more than one SOS kept for a rider is sent oldest
  // first, each whole (start, points, end) before the next one's start.
  describe('several SOS records for one rider (AC-4, AC-6)', () => {
    // An ended SOS whose end waits, then a new hold, both on the phone.
    const oldEndedThenNewHeld = async (oldStarted: boolean) => {
      await startSos(courierId, { clientId: 'c-old', heldAt: 1000 });
      if (oldStarted) {
        await markSosStarted(courierId, 'c-old', 'inc-old');
      }
      await addSosPoint(courierId, {
        latitude: 39.1,
        longitude: 22.1,
        takenAt: 1100,
      });
      await endSos(courierId, { kind: 'safe', tappedAt: 2000 });
      await startSos(courierId, { clientId: 'c-new', heldAt: 3000 });
      await addSosPoint(courierId, {
        latitude: 39.2,
        longitude: 22.2,
        takenAt: 3100,
      });
    };

    it('sends the old record whole (start, points, end) before the new one starts', async () => {
      await oldEndedThenNewHeld(false);

      const calls: string[] = [];
      mockApi.start.mockImplementation(async body => {
        calls.push(`start:${body.clientId}`);
        return incident(body.clientId === 'c-old' ? 'inc-old' : 'inc-new');
      });
      mockApi.sendPoints.mockImplementation(async (id, points) => {
        calls.push(`points:${id}:${points.length}`);
        return { kind: 'ok', result: { accepted: points.length } };
      });
      mockApi.end.mockImplementation(async id => {
        calls.push(`end:${id}`);
        return incident(id, 'AWAITING_CLOSE');
      });

      await sendSos(
        courierId,
        mockApi,
        () => courierId,
        () => 4000,
      );

      expect(calls).toEqual([
        'start:c-old',
        'points:inc-old:1',
        'end:inc-old',
        'start:c-new',
        'points:inc-new:1',
      ]);
      const left = await loadSosRecords(courierId);
      expect(left.map(record => record.clientId)).toEqual(['c-new']);
      expect(left[0].incidentId).toBe('inc-new');
    });

    it('does not send the new start while the old end gets no signal, then sends it once the old end lands', async () => {
      await oldEndedThenNewHeld(true);
      mockApi.sendPoints.mockResolvedValue({
        kind: 'ok',
        result: { accepted: 1 },
      });
      mockApi.end.mockResolvedValueOnce({ kind: 'none' });

      // Round 1: the old end gets no signal.
      const first = await sendSos(courierId, mockApi, () => courierId);

      expect(first).toBe('noSignal');
      expect(mockApi.end).toHaveBeenCalledTimes(1);
      expect(mockApi.end).toHaveBeenCalledWith(
        'inc-old',
        'safe',
        expect.any(Number),
      );
      expect(mockApi.start).not.toHaveBeenCalled();
      expect(
        (await loadSosRecords(courierId)).map(record => record.clientId),
      ).toEqual(['c-old', 'c-new']);

      // Round 2: the old end lands; the old one is cleared and the new start
      // goes in this round or the next one.
      mockApi.end.mockResolvedValueOnce(incident('inc-old', 'AWAITING_CLOSE'));
      mockApi.start.mockResolvedValue(incident('inc-new'));

      await sendSos(courierId, mockApi, () => courierId);
      expect(
        (await loadSosRecords(courierId)).map(record => record.clientId),
      ).toEqual(['c-new']);
      await sendSos(courierId, mockApi, () => courierId);

      expect(mockApi.end).toHaveBeenCalledTimes(2);
      expect(mockApi.start).toHaveBeenCalledTimes(1);
      expect(mockApi.start).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'c-new' }),
      );
      const left = await loadSosRecords(courierId);
      expect(left.map(record => record.clientId)).toEqual(['c-new']);
      expect(left[0].incidentId).toBe('inc-new');
      // The end is sent before the new start.
      expect(mockApi.end.mock.invocationCallOrder[1]).toBeLessThan(
        mockApi.start.mock.invocationCallOrder[0],
      );
    });

    it('does not send the new start while the old start itself gets no signal', async () => {
      await oldEndedThenNewHeld(false);
      mockApi.start.mockResolvedValueOnce({ kind: 'none' });

      const outcome = await sendSos(courierId, mockApi, () => courierId);

      expect(outcome).toBe('noSignal');
      expect(mockApi.start).toHaveBeenCalledTimes(1);
      expect(mockApi.start).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'c-old' }),
      );
      expect(mockApi.end).not.toHaveBeenCalled();
    });
  });

  // Row 73 review fix: every age is capped at the server's 7 days.
  describe('ages capped at SOS_MAX_AGE_MS (7 days)', () => {
    const now = 20 * 24 * 60 * 60 * 1000;
    const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;

    it('is 7 days', () => {
      expect(SOS_MAX_AGE_MS).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it("caps the start's tapAgeMs for a hold more than 7 days ago", async () => {
      await startSos(courierId, { clientId: 'c1', heldAt: eightDaysAgo });
      mockApi.start.mockResolvedValueOnce(incident('inc-1'));

      await sendSos(
        courierId,
        mockApi,
        () => courierId,
        () => now,
      );

      expect(mockApi.start).toHaveBeenCalledWith({
        clientId: 'c1',
        tapAgeMs: SOS_MAX_AGE_MS,
      });
    });

    it("caps each point's ageMs for a point taken more than 7 days ago, and leaves a recent one exact", async () => {
      await startSos(courierId, { clientId: 'c1', heldAt: eightDaysAgo });
      await markSosStarted(courierId, 'c1', 'inc-1');
      await addSosPoint(courierId, {
        latitude: 39.1,
        longitude: 22.1,
        takenAt: eightDaysAgo,
      });
      await addSosPoint(courierId, {
        latitude: 39.2,
        longitude: 22.2,
        takenAt: now - 60000,
      });
      mockApi.sendPoints.mockResolvedValueOnce({
        kind: 'ok',
        result: { accepted: 2 },
      });

      await sendSos(
        courierId,
        mockApi,
        () => courierId,
        () => now,
      );

      const sent: SosPointToSend[] = mockApi.sendPoints.mock.calls[0][1];
      expect(sent.map(point => point.ageMs)).toEqual([SOS_MAX_AGE_MS, 60000]);
    });

    it("caps the end's tapAgeMs for an end tapped more than 7 days ago", async () => {
      await startSos(courierId, { clientId: 'c1', heldAt: eightDaysAgo });
      await markSosStarted(courierId, 'c1', 'inc-1');
      await endSos(courierId, { kind: 'falseAlarm', tappedAt: eightDaysAgo });
      mockApi.end.mockResolvedValueOnce(incident('inc-1', 'AWAITING_CLOSE'));

      await sendSos(
        courierId,
        mockApi,
        () => courierId,
        () => now,
      );

      expect(mockApi.end).toHaveBeenCalledWith(
        'inc-1',
        'falseAlarm',
        SOS_MAX_AGE_MS,
      );
    });
  });

  // Row 73 review nit: sent points are dropped by identity, not by count.
  describe('a fix landing on a full buffer while a batch is in flight', () => {
    it('every point taken is sent once and none is lost', async () => {
      const now = 10_000_000;
      await startSos(courierId, { clientId: 'c1', heldAt: 0 });
      await markSosStarted(courierId, 'c1', 'inc-1');
      for (let i = 0; i < SOS_MAX_WAITING_POINTS; i++) {
        await addSosPoint(courierId, {
          latitude: 39,
          longitude: 22,
          takenAt: 1000 + i,
        });
      }

      const sentTakenAt: number[] = [];
      let firstCall = true;
      mockApi.sendPoints.mockImplementation(async (_id, points) => {
        points.forEach(point => sentTakenAt.push(now - point.ageMs));
        if (firstCall) {
          firstCall = false;
          // A new fix while the first batch is on its way: the buffer is
          // full, so its oldest point (already in this batch) is trimmed.
          await addSosPoint(courierId, {
            latitude: 39,
            longitude: 22,
            takenAt: 1000 + SOS_MAX_WAITING_POINTS,
          });
        }
        return { kind: 'ok', result: { accepted: points.length } };
      });

      await sendSos(
        courierId,
        mockApi,
        () => courierId,
        () => now,
      );

      const expected = Array.from(
        { length: SOS_MAX_WAITING_POINTS + 1 },
        (_, i) => 1000 + i,
      );
      expect(sentTakenAt).toEqual(expected);
      expect((await loadSosRecord(courierId))?.points).toEqual([]);
    });
  });
});

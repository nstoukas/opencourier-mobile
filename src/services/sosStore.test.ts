import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SosEnd,
  SosPoint,
  addSosPoint,
  clearSos,
  dropSentSosPoints,
  dropSosDelivery,
  endSos,
  getSosRecord,
  isSharing,
  loadSosRecord,
  loadSosRecords,
  markSosStarted,
  SOS_MAX_WAITING_POINTS,
  resetSosStoreForTests,
  resumeSos,
  startSos,
  stopSosForLogout,
} from './sosStore';

describe('sosStore (spec 0022, AC-5, AC-12)', () => {
  beforeEach(async () => {
    resetSosStoreForTests();
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('rider keying', () => {
    it('isolates records by courierId so another rider reads nothing', async () => {
      await startSos('rider-1', {
        clientId: 'client-1',
        heldAt: 1000,
        deliveryId: 'del-1',
      });

      expect(getSosRecord('rider-1')?.clientId).toBe('client-1');
      expect(getSosRecord('rider-2')).toBeUndefined();
      expect(getSosRecord(undefined)).toBeUndefined();

      const loaded1 = await loadSosRecord('rider-1');
      const loaded2 = await loadSosRecord('rider-2');
      expect(loaded1?.clientId).toBe('client-1');
      expect(loaded2).toBeUndefined();
    });
  });

  describe('startSos', () => {
    it('keeps an SOS already present on a second start', async () => {
      await startSos('rider-1', {
        clientId: 'client-original',
        heldAt: 1000,
        deliveryId: 'del-original',
      });

      await startSos('rider-1', {
        clientId: 'client-second',
        heldAt: 2000,
        deliveryId: 'del-second',
      });

      const record = await loadSosRecord('rider-1');
      expect(record?.clientId).toBe('client-original');
      expect(record?.heldAt).toBe(1000);
      expect(record?.deliveryId).toBe('del-original');
    });
  });

  describe('addSosPoint and SOS_MAX_WAITING_POINTS', () => {
    it('keeps at most 360 points and drops the oldest when exceeded', async () => {
      await startSos('rider-1', { clientId: 'client-1', heldAt: 1000 });

      // Add 361 points
      for (let i = 0; i <= 360; i++) {
        await addSosPoint('rider-1', {
          latitude: 39.0 + i * 0.0001,
          longitude: 22.0,
          accuracyMetres: 5,
          takenAt: 1000 + i * 5000,
        });
      }

      const record = await loadSosRecord('rider-1');
      expect(record?.points.length).toBe(360);
      // The first point (i = 0) was dropped; oldest point remaining is i = 1
      expect(record?.points[0].takenAt).toBe(1000 + 1 * 5000);
      expect(record?.points[359].takenAt).toBe(1000 + 360 * 5000);
    });

    it('adds nothing once the rider has ended the SOS', async () => {
      await startSos('rider-1', { clientId: 'client-1', heldAt: 1000 });
      await addSosPoint('rider-1', {
        latitude: 39.1,
        longitude: 22.1,
        takenAt: 1500,
      });

      await endSos('rider-1', { kind: 'safe', tappedAt: 2000 });

      // Try adding another point after ending
      await addSosPoint('rider-1', {
        latitude: 39.2,
        longitude: 22.2,
        takenAt: 2500,
      });

      const record = await loadSosRecord('rider-1');
      expect(record?.points.length).toBe(1);
      expect(record?.points[0].takenAt).toBe(1500);
    });
  });

  describe('endSos', () => {
    it('keeps the first end if called a second time', async () => {
      await startSos('rider-1', { clientId: 'client-1', heldAt: 1000 });

      await endSos('rider-1', { kind: 'safe', tappedAt: 2000 });
      await endSos('rider-1', { kind: 'falseAlarm', tappedAt: 3000 });

      const record = await loadSosRecord('rider-1');
      expect(record?.end).toEqual<SosEnd>({ kind: 'safe', tappedAt: 2000 });
    });
  });

  describe('isSharing', () => {
    it('is true only with an existing record and no end', () => {
      expect(isSharing(undefined)).toBe(false);

      const activeRecord = {
        clientId: 'c1',
        heldAt: 1000,
        points: [],
      };
      expect(isSharing(activeRecord)).toBe(true);

      const endedRecord = {
        ...activeRecord,
        end: { kind: 'safe' as const, tappedAt: 2000 },
      };
      expect(isSharing(endedRecord)).toBe(false);
    });
  });

  describe('storage error recovery', () => {
    it('never treats a failed storage read as "no SOS" and waits for a read that works', async () => {
      const stored = {
        'rider-1': { clientId: 'c-stored', heldAt: 5000, points: [] },
      };
      await AsyncStorage.setItem('sosByRider', JSON.stringify(stored));

      const origGetItem = (
        AsyncStorage.getItem as jest.Mock
      ).getMockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
        new Error('Disk read failure'),
      );

      // First read attempt fails and throws
      await expect(loadSosRecord('rider-1')).rejects.toThrow(
        'Disk read failure',
      );

      // Next read succeeds without having wiped the waiting record
      (AsyncStorage.getItem as jest.Mock).mockImplementation(origGetItem);
      const record = await loadSosRecord('rider-1');
      expect(record?.clientId).toBe('c-stored');
    });
  });

  describe('stopSosForLogout', () => {
    it('keeps a start the server never had (no incidentId) with points dropped', async () => {
      await startSos('rider-1', {
        clientId: 'c-unsent',
        heldAt: 1000,
        deliveryId: 'del-1',
      });
      await addSosPoint('rider-1', {
        latitude: 39.1,
        longitude: 22.1,
        takenAt: 1500,
      });

      await stopSosForLogout('rider-1');

      const record = await loadSosRecord('rider-1');
      expect(record).toBeDefined();
      expect(record?.clientId).toBe('c-unsent');
      expect(record?.incidentId).toBeUndefined();
      expect(record?.deliveryId).toBe('del-1');
      expect(record?.points).toEqual([]);
    });

    it('removes a started SOS (with incidentId) on logout so server stays active for admin', async () => {
      await startSos('rider-1', { clientId: 'c-started', heldAt: 1000 });
      await markSosStarted('rider-1', 'c-started', 'inc-123');

      await stopSosForLogout('rider-1');

      const record = await loadSosRecord('rider-1');
      expect(record).toBeUndefined();
    });
  });

  describe('resumeSos', () => {
    it('keeps a local unsent record and attaches the server incident id', async () => {
      await startSos('rider-1', { clientId: 'c-local', heldAt: 1000 });
      await addSosPoint('rider-1', {
        latitude: 39.1,
        longitude: 22.1,
        takenAt: 1500,
      });

      await resumeSos(
        'rider-1',
        { id: 'inc-server-1', startedAt: 1000 },
        'c-fresh',
      );

      const record = await loadSosRecord('rider-1');
      expect(record?.clientId).toBe('c-local');
      expect(record?.incidentId).toBe('inc-server-1');
      expect(record?.points.length).toBe(1);
    });

    it('keeps local record if it matches the same incident id', async () => {
      await startSos('rider-1', { clientId: 'c-local', heldAt: 1000 });
      await markSosStarted('rider-1', 'c-local', 'inc-server-1');
      await addSosPoint('rider-1', {
        latitude: 39.1,
        longitude: 22.1,
        takenAt: 1500,
      });

      await resumeSos(
        'rider-1',
        { id: 'inc-server-1', startedAt: 1000 },
        'c-fresh',
      );

      const record = await loadSosRecord('rider-1');
      expect(record?.clientId).toBe('c-local');
      expect(record?.incidentId).toBe('inc-server-1');
      expect(record?.points.length).toBe(1);
    });

    it('makes a fresh record with server id when there is no local record or different incident', async () => {
      await resumeSos(
        'rider-1',
        { id: 'inc-server-new', startedAt: 2000 },
        'c-fresh',
      );

      const record = await loadSosRecord('rider-1');
      expect(record?.clientId).toBe('c-fresh');
      expect(record?.incidentId).toBe('inc-server-new');
      expect(record?.heldAt).toBe(2000);
      expect(record?.points).toEqual([]);
    });
  });

  describe('markSosStarted, dropSosDelivery, dropSentSosPoints, clearSos', () => {
    it('markSosStarted updates incidentId only if clientId matches', async () => {
      await startSos('rider-1', { clientId: 'client-1', heldAt: 1000 });
      await markSosStarted('rider-1', 'mismatched-client', 'inc-abc');
      let record = await loadSosRecord('rider-1');
      expect(record?.incidentId).toBeUndefined();

      await markSosStarted('rider-1', 'client-1', 'inc-abc');
      record = await loadSosRecord('rider-1');
      expect(record?.incidentId).toBe('inc-abc');
    });

    it('dropSosDelivery clears deliveryId from record', async () => {
      await startSos('rider-1', {
        clientId: 'client-1',
        heldAt: 1000,
        deliveryId: 'del-123',
      });
      await dropSosDelivery('rider-1', 'client-1');
      const record = await loadSosRecord('rider-1');
      expect(record?.deliveryId).toBeUndefined();
    });

    it('dropSentSosPoints removes the points that were sent', async () => {
      await startSos('rider-1', { clientId: 'client-1', heldAt: 1000 });
      const p1: SosPoint = { latitude: 39, longitude: 22, takenAt: 100 };
      const p2: SosPoint = { latitude: 39.1, longitude: 22.1, takenAt: 200 };
      const p3: SosPoint = { latitude: 39.2, longitude: 22.2, takenAt: 300 };
      await addSosPoint('rider-1', p1);
      await addSosPoint('rider-1', p2);
      await addSosPoint('rider-1', p3);

      await dropSentSosPoints('rider-1', 'client-1', [p1, p2]);
      const record = await loadSosRecord('rider-1');
      expect(record?.points).toEqual([p3]);
    });

    it('clearSos removes the rider record completely', async () => {
      await startSos('rider-1', { clientId: 'client-1', heldAt: 1000 });
      await clearSos('rider-1', 'client-1');
      const record = await loadSosRecord('rider-1');
      expect(record).toBeUndefined();
    });
  });

  // Row 73 review fix (AC-4, AC-6): a hold after "I'm safe" or "False alarm"
  // is a new SOS, even while the end of the last one still waits for signal.
  describe('a new hold after an ended SOS whose end is unsent (AC-4)', () => {
    it('makes a new shared record with the new clientId and keeps the ended one', async () => {
      await startSos('rider-1', { clientId: 'c-old', heldAt: 1000 });
      await markSosStarted('rider-1', 'c-old', 'inc-old');
      await endSos('rider-1', { kind: 'safe', tappedAt: 2000 });

      await startSos('rider-1', {
        clientId: 'c-new',
        heldAt: 3000,
        deliveryId: 'del-new',
      });

      const shown = getSosRecord('rider-1');
      expect(shown?.clientId).toBe('c-new');
      expect(shown?.heldAt).toBe(3000);
      expect(shown?.deliveryId).toBe('del-new');
      expect(shown?.incidentId).toBeUndefined();
      expect(isSharing(shown)).toBe(true);
      expect((await loadSosRecord('rider-1'))?.clientId).toBe('c-new');

      const all = await loadSosRecords('rider-1');
      expect(all.map(record => record.clientId)).toEqual(['c-old', 'c-new']);
      expect(all[0].incidentId).toBe('inc-old');
      expect(all[0].end).toEqual<SosEnd>({ kind: 'safe', tappedAt: 2000 });
    });

    it('also makes a new record after a false alarm whose start never reached the server', async () => {
      await startSos('rider-1', { clientId: 'c-old', heldAt: 1000 });
      await endSos('rider-1', { kind: 'falseAlarm', tappedAt: 1500 });

      await startSos('rider-1', { clientId: 'c-new', heldAt: 3000 });

      expect(getSosRecord('rider-1')?.clientId).toBe('c-new');
      expect(isSharing(getSosRecord('rider-1'))).toBe(true);
      const all = await loadSosRecords('rider-1');
      expect(all.map(record => record.clientId)).toEqual(['c-old', 'c-new']);
      expect(all[0].end?.kind).toBe('falseAlarm');
    });

    it('a hold while the new SOS is still shared changes nothing (no third record)', async () => {
      await startSos('rider-1', { clientId: 'c-old', heldAt: 1000 });
      await endSos('rider-1', { kind: 'safe', tappedAt: 2000 });
      await startSos('rider-1', { clientId: 'c-new', heldAt: 3000 });

      await startSos('rider-1', { clientId: 'c-third', heldAt: 4000 });

      const all = await loadSosRecords('rider-1');
      expect(all.map(record => record.clientId)).toEqual(['c-old', 'c-new']);
      expect(getSosRecord('rider-1')?.heldAt).toBe(3000);
    });

    it('points and the end go to the new SOS; the old one is not touched', async () => {
      await startSos('rider-1', { clientId: 'c-old', heldAt: 1000 });
      await addSosPoint('rider-1', {
        latitude: 39.1,
        longitude: 22.1,
        takenAt: 1100,
      });
      await endSos('rider-1', { kind: 'safe', tappedAt: 2000 });
      await startSos('rider-1', { clientId: 'c-new', heldAt: 3000 });

      await addSosPoint('rider-1', {
        latitude: 39.2,
        longitude: 22.2,
        takenAt: 3100,
      });
      await endSos('rider-1', { kind: 'falseAlarm', tappedAt: 4000 });

      const [old, recent] = await loadSosRecords('rider-1');
      expect(old.points.map(point => point.takenAt)).toEqual([1100]);
      expect(old.end).toEqual<SosEnd>({ kind: 'safe', tappedAt: 2000 });
      expect(recent.points.map(point => point.takenAt)).toEqual([3100]);
      expect(recent.end).toEqual<SosEnd>({
        kind: 'falseAlarm',
        tappedAt: 4000,
      });
    });

    it('markSosStarted, dropSosDelivery and clearSos change only the record with that clientId', async () => {
      await startSos('rider-1', {
        clientId: 'c-old',
        heldAt: 1000,
        deliveryId: 'del-old',
      });
      await endSos('rider-1', { kind: 'safe', tappedAt: 2000 });
      await startSos('rider-1', {
        clientId: 'c-new',
        heldAt: 3000,
        deliveryId: 'del-new',
      });

      await markSosStarted('rider-1', 'c-old', 'inc-old');
      await dropSosDelivery('rider-1', 'c-new');
      const [old, recent] = await loadSosRecords('rider-1');
      expect(old.incidentId).toBe('inc-old');
      expect(old.deliveryId).toBe('del-old');
      expect(recent.incidentId).toBeUndefined();
      expect(recent.deliveryId).toBeUndefined();

      await clearSos('rider-1', 'c-old');
      const all = await loadSosRecords('rider-1');
      expect(all.map(record => record.clientId)).toEqual(['c-new']);
      expect(isSharing(getSosRecord('rider-1'))).toBe(true);
    });
  });

  describe('stored data from before the review fix (one record per rider)', () => {
    it('reads a single stored record as a one item list and keeps using it', async () => {
      const legacy = {
        'rider-1': {
          clientId: 'c-legacy',
          heldAt: 5000,
          incidentId: 'inc-legacy',
          points: [{ latitude: 39.1, longitude: 22.1, takenAt: 5100 }],
        },
      };
      await AsyncStorage.setItem('sosByRider', JSON.stringify(legacy));

      const all = await loadSosRecords('rider-1');
      expect(Array.isArray(all)).toBe(true);
      expect(all).toHaveLength(1);
      expect(all[0].clientId).toBe('c-legacy');
      expect(all[0].incidentId).toBe('inc-legacy');
      expect((await loadSosRecord('rider-1'))?.clientId).toBe('c-legacy');
      expect(getSosRecord('rider-1')?.clientId).toBe('c-legacy');
      expect(isSharing(getSosRecord('rider-1'))).toBe(true);

      // Still used: a new point lands on it and is saved as a list.
      await addSosPoint('rider-1', {
        latitude: 39.2,
        longitude: 22.2,
        takenAt: 5200,
      });
      expect(
        (await loadSosRecord('rider-1'))?.points.map(point => point.takenAt),
      ).toEqual([5100, 5200]);
      const saved = JSON.parse(
        (await AsyncStorage.getItem('sosByRider')) as string,
      );
      expect(Array.isArray(saved['rider-1'])).toBe(true);
      expect(saved['rider-1'][0].clientId).toBe('c-legacy');
    });

    it('a legacy ended record followed by a new hold becomes a two item list', async () => {
      const legacy = {
        'rider-1': {
          clientId: 'c-legacy',
          heldAt: 5000,
          incidentId: 'inc-legacy',
          points: [],
          end: { kind: 'safe', tappedAt: 6000 },
        },
      };
      await AsyncStorage.setItem('sosByRider', JSON.stringify(legacy));

      await startSos('rider-1', { clientId: 'c-new', heldAt: 7000 });

      const all = await loadSosRecords('rider-1');
      expect(all.map(record => record.clientId)).toEqual(['c-legacy', 'c-new']);
    });
  });

  describe('stopSosForLogout with an end waiting (row 73 review)', () => {
    it('keeps a record whose end is unsent (incidentId set), with its points cleared', async () => {
      await startSos('rider-1', { clientId: 'c-ended', heldAt: 1000 });
      await markSosStarted('rider-1', 'c-ended', 'inc-1');
      await addSosPoint('rider-1', {
        latitude: 39.1,
        longitude: 22.1,
        takenAt: 1500,
      });
      await endSos('rider-1', { kind: 'safe', tappedAt: 2000 });

      await stopSosForLogout('rider-1');

      const all = await loadSosRecords('rider-1');
      expect(all).toHaveLength(1);
      expect(all[0].clientId).toBe('c-ended');
      expect(all[0].incidentId).toBe('inc-1');
      expect(all[0].end).toEqual<SosEnd>({ kind: 'safe', tappedAt: 2000 });
      expect(all[0].points).toEqual([]);
    });

    it('with three records keeps the unsent start and the unsent end, drops the sent unended one', async () => {
      // An ended SOS the server has, whose "I'm safe" waits.
      await startSos('rider-1', { clientId: 'c-end-waits', heldAt: 1000 });
      await markSosStarted('rider-1', 'c-end-waits', 'inc-a');
      await addSosPoint('rider-1', {
        latitude: 39.1,
        longitude: 22.1,
        takenAt: 1100,
      });
      await endSos('rider-1', { kind: 'safe', tappedAt: 1200 });
      // A false alarm whose start never reached the server.
      await startSos('rider-1', { clientId: 'c-start-waits', heldAt: 2000 });
      await addSosPoint('rider-1', {
        latitude: 39.2,
        longitude: 22.2,
        takenAt: 2100,
      });
      await endSos('rider-1', { kind: 'falseAlarm', tappedAt: 2200 });
      // The live one: the server has it, the rider did not end it.
      await startSos('rider-1', { clientId: 'c-live', heldAt: 3000 });
      await markSosStarted('rider-1', 'c-live', 'inc-c');
      await addSosPoint('rider-1', {
        latitude: 39.3,
        longitude: 22.3,
        takenAt: 3100,
      });

      await stopSosForLogout('rider-1');

      const all = await loadSosRecords('rider-1');
      expect(all.map(record => record.clientId)).toEqual([
        'c-end-waits',
        'c-start-waits',
      ]);
      expect(all.every(record => record.points.length === 0)).toBe(true);
      expect(all[0].end?.kind).toBe('safe');
      expect(all[1].end?.kind).toBe('falseAlarm');
      expect(all[1].incidentId).toBeUndefined();
    });
  });

  describe('dropSentSosPoints drops by identity (row 73 review nit)', () => {
    it('loses no unsent point when the full buffer trims its head while a batch is in flight', async () => {
      await startSos('rider-1', { clientId: 'client-1', heldAt: 0 });
      await markSosStarted('rider-1', 'client-1', 'inc-1');
      for (let i = 0; i < SOS_MAX_WAITING_POINTS; i++) {
        await addSosPoint('rider-1', {
          latitude: 39,
          longitude: 22,
          takenAt: i,
        });
      }

      // The batch on its way: the first 120.
      const batch = (await loadSosRecord('rider-1'))!.points.slice(0, 120);
      // A fix lands meanwhile: the buffer is full, so point 0 is trimmed.
      await addSosPoint('rider-1', {
        latitude: 39,
        longitude: 22,
        takenAt: SOS_MAX_WAITING_POINTS,
      });
      await dropSentSosPoints('rider-1', 'client-1', batch);

      const left = (await loadSosRecord('rider-1'))!.points.map(
        point => point.takenAt,
      );
      // Every point not in the batch is still there: 120 .. 360.
      const expected = Array.from(
        { length: SOS_MAX_WAITING_POINTS - 120 + 1 },
        (_, i) => 120 + i,
      );
      expect(left).toEqual(expected);
    });

    it('drops points with the sent takenAt values only, wherever they are', async () => {
      await startSos('rider-1', { clientId: 'client-1', heldAt: 0 });
      const p1: SosPoint = { latitude: 39, longitude: 22, takenAt: 100 };
      const p2: SosPoint = { latitude: 39.1, longitude: 22.1, takenAt: 200 };
      const p3: SosPoint = { latitude: 39.2, longitude: 22.2, takenAt: 300 };
      await addSosPoint('rider-1', p1);
      await addSosPoint('rider-1', p2);
      await addSosPoint('rider-1', p3);

      await dropSentSosPoints('rider-1', 'client-1', [p2]);

      expect((await loadSosRecord('rider-1'))?.points).toEqual([p1, p3]);
    });
  });
});

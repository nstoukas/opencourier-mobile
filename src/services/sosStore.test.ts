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
  markSosStarted,
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
      await dropSosDelivery('rider-1');
      const record = await loadSosRecord('rider-1');
      expect(record?.deliveryId).toBeUndefined();
    });

    it('dropSentSosPoints removes the first count points', async () => {
      await startSos('rider-1', { clientId: 'client-1', heldAt: 1000 });
      const p1: SosPoint = { latitude: 39, longitude: 22, takenAt: 100 };
      const p2: SosPoint = { latitude: 39.1, longitude: 22.1, takenAt: 200 };
      const p3: SosPoint = { latitude: 39.2, longitude: 22.2, takenAt: 300 };
      await addSosPoint('rider-1', p1);
      await addSosPoint('rider-1', p2);
      await addSosPoint('rider-1', p3);

      await dropSentSosPoints('rider-1', 2);
      const record = await loadSosRecord('rider-1');
      expect(record?.points).toEqual([p3]);
    });

    it('clearSos removes the rider record completely', async () => {
      await startSos('rider-1', { clientId: 'client-1', heldAt: 1000 });
      await clearSos('rider-1');
      const record = await loadSosRecord('rider-1');
      expect(record).toBeUndefined();
    });
  });
});

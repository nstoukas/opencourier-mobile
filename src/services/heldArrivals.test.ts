import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearHeldArrivals,
  dropHeldArrival,
  findHeldArrival,
  getHeldArrivals,
  holdArrival,
  keepHeldArrivalsFor,
  resetHeldArrivalsForTests,
  subscribeHeldArrivals,
} from './heldArrivals';

describe('heldArrivals store (spec 0021, AC-12)', () => {
  beforeEach(async () => {
    resetHeldArrivalsForTests();
    await AsyncStorage.clear();
  });

  afterEach(async () => {
    resetHeldArrivalsForTests();
    await AsyncStorage.clear();
  });

  it('holds a detected pickup arrival and persists to AsyncStorage', async () => {
    const arrival = {
      courierId: 'rider-1',
      deliveryId: 'del-101',
      firstFixAt: 1700000000000,
    };

    await holdArrival(arrival);

    const found = await findHeldArrival('rider-1', 'del-101');
    expect(found).toEqual(arrival);

    const storedRaw = await AsyncStorage.getItem('heldArrivals');
    expect(storedRaw).toBeTruthy();
    expect(JSON.parse(storedRaw!)).toEqual([arrival]);
  });

  it('preserves the first fix time if holdArrival is called again for the same delivery', async () => {
    await holdArrival({
      courierId: 'rider-1',
      deliveryId: 'del-101',
      firstFixAt: 1700000000000,
    });

    // Later fix attempt should be ignored
    await holdArrival({
      courierId: 'rider-1',
      deliveryId: 'del-101',
      firstFixAt: 1700000010000,
    });

    const found = await findHeldArrival('rider-1', 'del-101');
    expect(found?.firstFixAt).toBe(1700000000000);
  });

  it('drops a held arrival and updates AsyncStorage', async () => {
    await holdArrival({
      courierId: 'rider-1',
      deliveryId: 'del-101',
      firstFixAt: 1700000000000,
    });
    await holdArrival({
      courierId: 'rider-1',
      deliveryId: 'del-102',
      firstFixAt: 1700000001000,
    });

    await dropHeldArrival('rider-1', 'del-101');

    expect(await findHeldArrival('rider-1', 'del-101')).toBeNull();
    expect(await findHeldArrival('rider-1', 'del-102')).not.toBeNull();

    const storedRaw = await AsyncStorage.getItem('heldArrivals');
    const stored = JSON.parse(storedRaw!);
    expect(stored).toHaveLength(1);
    expect(stored[0].deliveryId).toBe('del-102');
  });

  it('keepHeldArrivalsFor drops holds for deliveries no longer held by this courier', async () => {
    await holdArrival({
      courierId: 'rider-1',
      deliveryId: 'del-1',
      firstFixAt: 100,
    });
    await holdArrival({
      courierId: 'rider-1',
      deliveryId: 'del-2',
      firstFixAt: 200,
    });
    await holdArrival({
      courierId: 'rider-2',
      deliveryId: 'del-3',
      firstFixAt: 300,
    });

    // rider-1 now only has del-1
    await keepHeldArrivalsFor('rider-1', new Set(['del-1']));

    expect(await findHeldArrival('rider-1', 'del-1')).not.toBeNull();
    expect(await findHeldArrival('rider-1', 'del-2')).toBeNull();
    // other rider is dropped because it does not match rider-1
    expect(await findHeldArrival('rider-2', 'del-3')).toBeNull();
  });

  it('clearHeldArrivals empties the store (at logout)', async () => {
    await holdArrival({
      courierId: 'rider-1',
      deliveryId: 'del-1',
      firstFixAt: 100,
    });

    await clearHeldArrivals();

    expect(await findHeldArrival('rider-1', 'del-1')).toBeNull();
    expect(getHeldArrivals()).toEqual([]);
    const storedRaw = await AsyncStorage.getItem('heldArrivals');
    expect(JSON.parse(storedRaw!)).toEqual([]);
  });

  it('survives an app restart: recovers held arrivals from AsyncStorage after memory reset', async () => {
    await holdArrival({
      courierId: 'rider-1',
      deliveryId: 'del-restart',
      firstFixAt: 1700000055555,
    });

    // Simulate app restart / module reload by wiping in-memory state
    resetHeldArrivalsForTests();

    // Next access reads from AsyncStorage
    const recovered = await findHeldArrival('rider-1', 'del-restart');
    expect(recovered).toEqual({
      courierId: 'rider-1',
      deliveryId: 'del-restart',
      firstFixAt: 1700000055555,
    });
  });

  it('notifies subscribers when held arrivals change', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeHeldArrivals(listener);

    await holdArrival({
      courierId: 'rider-1',
      deliveryId: 'del-sub',
      firstFixAt: 12345,
    });

    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    unsubscribe();

    await dropHeldArrival('rider-1', 'del-sub');
    expect(listener).not.toHaveBeenCalled();
  });
});

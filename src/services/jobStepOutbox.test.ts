import AsyncStorage from '@react-native-async-storage/async-storage';
import { OrderStatus } from '@app/types/enums';
import {
  classifyAnswer,
  addJobSteps,
  flushOutbox,
  dismissRefused,
  waitingCount,
  getOutboxItems,
  resetOutboxForTests,
  StepAnswer,
  OutboxItem,
} from './jobStepOutbox';

describe('jobStepOutbox (spec 0009, AC-3, AC-6, AC-8)', () => {
  beforeEach(async () => {
    resetOutboxForTests();
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('AC-6 classification (classifyAnswer)', () => {
    it('delivery answer at or past the step status is sent (including later status and repeats)', () => {
      // At the step's target status
      expect(
        classifyAnswer('dispatched', {
          kind: 'delivery',
          status: OrderStatus.dispatched,
        }),
      ).toBe('sent');
      expect(
        classifyAnswer('arrived_at_pickup', {
          kind: 'delivery',
          status: OrderStatus.courier_arrived_at_pickup_location,
        }),
      ).toBe('sent');
      expect(
        classifyAnswer('picked_up', {
          kind: 'delivery',
          status: OrderStatus.picked_up,
        }),
      ).toBe('sent');
      expect(
        classifyAnswer('arrived_at_dropoff', {
          kind: 'delivery',
          status: OrderStatus.courier_arrived_at_dropoff_location,
        }),
      ).toBe('sent');
      expect(
        classifyAnswer('delivered', {
          kind: 'delivery',
          status: OrderStatus.dropped_off,
        }),
      ).toBe('sent');

      // Past the step status (e.g. repeat after a lost answer)
      expect(
        classifyAnswer('dispatched', {
          kind: 'delivery',
          status: OrderStatus.picked_up,
        }),
      ).toBe('sent');
      expect(
        classifyAnswer('arrived_at_pickup', {
          kind: 'delivery',
          status: OrderStatus.dropped_off,
        }),
      ).toBe('sent');
      expect(
        classifyAnswer('picked_up', {
          kind: 'delivery',
          status: OrderStatus.courier_arrived_at_dropoff_location,
        }),
      ).toBe('sent');
    });

    it('CANCELED or an earlier status is refused', () => {
      // CANCELED
      expect(
        classifyAnswer('delivered', {
          kind: 'delivery',
          status: OrderStatus.canceled,
        }),
      ).toBe('refused');
      expect(
        classifyAnswer('arrived_at_pickup', {
          kind: 'delivery',
          status: 'CANCELED',
        }),
      ).toBe('refused');

      // Earlier status
      expect(
        classifyAnswer('delivered', {
          kind: 'delivery',
          status: OrderStatus.courier_arrived_at_dropoff_location,
        }),
      ).toBe('refused');
      expect(
        classifyAnswer('picked_up', {
          kind: 'delivery',
          status: OrderStatus.dispatched,
        }),
      ).toBe('refused');
      expect(
        classifyAnswer('arrived_at_pickup', {
          kind: 'delivery',
          status: OrderStatus.accepted,
        }),
      ).toBe('refused');
    });

    it('409 CANT_UPDATE_DELIVERY_STATUS to dispatched is sent, but to any other step is refused', () => {
      const conflictAnswer: StepAnswer = {
        kind: 'error',
        httpStatus: 409,
        code: 'CANT_UPDATE_DELIVERY_STATUS',
      };

      // Dispatched treats already-dispatched 409 as sent
      expect(classifyAnswer('dispatched', conflictAnswer)).toBe('sent');

      // Any other step with same 409 is refused
      expect(classifyAnswer('arrived_at_pickup', conflictAnswer)).toBe(
        'refused',
      );
      expect(classifyAnswer('picked_up', conflictAnswer)).toBe('refused');
      expect(classifyAnswer('arrived_at_dropoff', conflictAnswer)).toBe(
        'refused',
      );
      expect(classifyAnswer('delivered', conflictAnswer)).toBe('refused');

      // 409 with a different code to dispatched is refused
      expect(
        classifyAnswer('dispatched', {
          kind: 'error',
          httpStatus: 409,
          code: 'OTHER_CONFLICT',
        }),
      ).toBe('refused');
    });

    it('401, 408, 429, 500, 503 and no answer are retry', () => {
      expect(classifyAnswer('picked_up', { kind: 'none' })).toBe('retry');
      expect(
        classifyAnswer('picked_up', { kind: 'error', httpStatus: 401 }),
      ).toBe('retry');
      expect(
        classifyAnswer('picked_up', { kind: 'error', httpStatus: 408 }),
      ).toBe('retry');
      expect(
        classifyAnswer('picked_up', { kind: 'error', httpStatus: 429 }),
      ).toBe('retry');
      expect(
        classifyAnswer('picked_up', { kind: 'error', httpStatus: 500 }),
      ).toBe('retry');
      expect(
        classifyAnswer('picked_up', { kind: 'error', httpStatus: 503 }),
      ).toBe('retry');
    });

    it('400, 403, 404 are refused', () => {
      expect(
        classifyAnswer('picked_up', { kind: 'error', httpStatus: 400 }),
      ).toBe('refused');
      expect(
        classifyAnswer('picked_up', { kind: 'error', httpStatus: 403 }),
      ).toBe('refused');
      expect(
        classifyAnswer('picked_up', { kind: 'error', httpStatus: 404 }),
      ).toBe('refused');
    });

    it('returns retry for a delivery answer with no status (undefined or empty) (AC-6)', () => {
      expect(
        classifyAnswer('arrived_at_pickup', {
          kind: 'delivery',
          status: undefined,
        }),
      ).toBe('retry');
      expect(
        classifyAnswer('arrived_at_pickup', {
          kind: 'delivery',
          status: '',
        }),
      ).toBe('retry');
      expect(
        classifyAnswer('delivered', {
          kind: 'delivery',
          status: undefined,
        }),
      ).toBe('retry');
    });
  });

  describe('Outbox store and persistence (AC-3, AC-8)', () => {
    it('addJobSteps keeps tap order and persists to AsyncStorage key jobStepOutbox (survives a restart, AC-3)', async () => {
      await addJobSteps([
        {
          courierId: 'rider-1',
          deliveryId: 'del-100',
          step: 'dispatched',
          tappedAt: 1000,
          restaurantName: 'Souvlaki Bar',
        },
        {
          courierId: 'rider-1',
          deliveryId: 'del-100',
          step: 'arrived_at_pickup',
          tappedAt: 1050,
          restaurantName: 'Souvlaki Bar',
        },
      ]);

      const storedRaw = await AsyncStorage.getItem('jobStepOutbox');
      expect(storedRaw).toBeTruthy();
      const stored = JSON.parse(storedRaw!);
      expect(stored).toHaveLength(2);
      expect(stored[0].step).toBe('dispatched');
      expect(stored[0].state).toBe('waiting');
      expect(stored[1].step).toBe('arrived_at_pickup');
      expect(stored[1].state).toBe('waiting');

      // Simulate app restart: memory wiped
      resetOutboxForTests();

      // Flush reloads from AsyncStorage
      const sentSteps: string[] = [];
      await flushOutbox('rider-1', async item => {
        sentSteps.push(item.step);
        return {
          kind: 'delivery',
          status:
            item.step === 'dispatched'
              ? OrderStatus.dispatched
              : OrderStatus.courier_arrived_at_pickup_location,
        };
      });

      expect(sentSteps).toEqual(['dispatched', 'arrived_at_pickup']);
      expect(getOutboxItems()).toHaveLength(0);
    });

    it('two addJobSteps calls in quick succession both persist without dropping either', async () => {
      const p1 = addJobSteps([
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'dispatched',
          tappedAt: 2000,
          restaurantName: 'Burger House',
        },
      ]);
      const p2 = addJobSteps([
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'arrived_at_pickup',
          tappedAt: 2050,
          restaurantName: 'Burger House',
        },
      ]);

      await Promise.all([p1, p2]);

      const items = getOutboxItems();
      expect(items).toHaveLength(2);
      expect(items[0].step).toBe('dispatched');
      expect(items[1].step).toBe('arrived_at_pickup');

      const raw = await AsyncStorage.getItem('jobStepOutbox');
      const saved = JSON.parse(raw!);
      expect(saved).toHaveLength(2);
    });

    it('waitingCount counts only that rider waiting items', async () => {
      await addJobSteps([
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'dispatched',
          tappedAt: 1000,
          restaurantName: 'R1',
        },
        {
          courierId: 'rider-1',
          deliveryId: 'del-2',
          step: 'arrived_at_pickup',
          tappedAt: 1010,
          restaurantName: 'R2',
        },
        {
          courierId: 'rider-2',
          deliveryId: 'del-3',
          step: 'dispatched',
          tappedAt: 1020,
          restaurantName: 'R3',
        },
      ]);

      expect(await waitingCount('rider-1')).toBe(2);
      expect(await waitingCount('rider-2')).toBe(1);
      expect(await waitingCount('rider-3')).toBe(0);
    });

    it('waitingCount is async and waits for the stored list (spec 0009, AC-8)', async () => {
      resetOutboxForTests();
      await AsyncStorage.setItem(
        'jobStepOutbox',
        JSON.stringify([
          {
            id: 'stored-1',
            courierId: 'rider-1',
            deliveryId: 'del-1',
            step: 'dispatched',
            tappedAt: 1000,
            state: 'waiting',
          },
        ]),
      );

      // Memory is not yet loaded, but awaiting waitingCount reads storage
      expect(await waitingCount('rider-1')).toBe(1);
    });

    it('dismissRefused(courierId, deliveryId) removes only that rider refused items of that delivery', async () => {
      await addJobSteps([
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'dispatched',
          tappedAt: 1000,
          restaurantName: 'R1',
        },
        {
          courierId: 'rider-2',
          deliveryId: 'del-1',
          step: 'dispatched',
          tappedAt: 1005,
          restaurantName: 'R1',
        },
        {
          courierId: 'rider-1',
          deliveryId: 'del-2',
          step: 'dispatched',
          tappedAt: 1010,
          restaurantName: 'R2',
        },
      ]);

      // Refuse all
      await flushOutbox('rider-1', async () => ({
        kind: 'error',
        httpStatus: 400,
      }));
      await flushOutbox('rider-2', async () => ({
        kind: 'error',
        httpStatus: 400,
      }));

      expect(getOutboxItems()).toHaveLength(3);
      expect(getOutboxItems().every(i => i.state === 'refused')).toBe(true);

      // Dismiss rider-1's del-1 only
      await dismissRefused('rider-1', 'del-1');

      const remaining = getOutboxItems();
      expect(remaining).toHaveLength(2);
      // rider-2's del-1 refused item is still present
      expect(
        remaining.some(
          i =>
            i.courierId === 'rider-2' &&
            i.deliveryId === 'del-1' &&
            i.state === 'refused',
        ),
      ).toBe(true);
      // rider-1's del-2 refused item is still present
      expect(
        remaining.some(
          i =>
            i.courierId === 'rider-1' &&
            i.deliveryId === 'del-2' &&
            i.state === 'refused',
        ),
      ).toBe(true);
      // rider-1's del-1 item was removed
      expect(
        remaining.some(
          i => i.courierId === 'rider-1' && i.deliveryId === 'del-1',
        ),
      ).toBe(false);
    });

    it('does not add a step already waiting for the same rider, delivery and step, but adds for another rider or delivery, and again once earlier one was sent or refused (double tap)', async () => {
      await addJobSteps([
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'arrived_at_pickup',
          tappedAt: 1000,
          restaurantName: 'R1',
        },
      ]);
      expect(getOutboxItems()).toHaveLength(1);

      // Double tap: same rider, delivery, and step -> not added
      await addJobSteps([
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'arrived_at_pickup',
          tappedAt: 1005,
          restaurantName: 'R1',
        },
      ]);
      expect(getOutboxItems()).toHaveLength(1);

      // Duplicate within the same addJobSteps call -> only one added
      await addJobSteps([
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'picked_up',
          tappedAt: 1010,
          restaurantName: 'R1',
        },
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'picked_up',
          tappedAt: 1011,
          restaurantName: 'R1',
        },
      ]);
      expect(getOutboxItems()).toHaveLength(2); // arrived_at_pickup and one picked_up

      // Adds for another rider
      await addJobSteps([
        {
          courierId: 'rider-2',
          deliveryId: 'del-1',
          step: 'arrived_at_pickup',
          tappedAt: 1020,
          restaurantName: 'R1',
        },
      ]);
      expect(getOutboxItems()).toHaveLength(3);

      // Adds for another delivery
      await addJobSteps([
        {
          courierId: 'rider-1',
          deliveryId: 'del-2',
          step: 'arrived_at_pickup',
          tappedAt: 1030,
          restaurantName: 'R2',
        },
      ]);
      expect(getOutboxItems()).toHaveLength(4);

      // Once earlier step is sent and removed, it can be added again
      await flushOutbox('rider-1', async () => ({
        kind: 'delivery',
        status: OrderStatus.picked_up,
      }));
      expect(
        getOutboxItems().filter(
          i => i.courierId === 'rider-1' && i.deliveryId === 'del-1',
        ),
      ).toHaveLength(0);

      await addJobSteps([
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'arrived_at_pickup',
          tappedAt: 2000,
          restaurantName: 'R1',
        },
      ]);
      expect(
        getOutboxItems().filter(
          i => i.courierId === 'rider-1' && i.deliveryId === 'del-1',
        ),
      ).toHaveLength(1);

      // Once earlier step is refused, it can be added again
      await flushOutbox('rider-1', async () => ({
        kind: 'error',
        httpStatus: 400,
      }));
      expect(
        getOutboxItems().find(
          i =>
            i.courierId === 'rider-1' &&
            i.deliveryId === 'del-1' &&
            i.step === 'arrived_at_pickup',
        )?.state,
      ).toBe('refused');

      await addJobSteps([
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'arrived_at_pickup',
          tappedAt: 3000,
          restaurantName: 'R1',
        },
      ]);
      const rider1Del1 = getOutboxItems().filter(
        i =>
          i.courierId === 'rider-1' &&
          i.deliveryId === 'del-1' &&
          i.step === 'arrived_at_pickup',
      );
      expect(rider1Del1).toHaveLength(2);
      expect(rider1Del1.some(i => i.state === 'refused')).toBe(true);
      expect(rider1Del1.some(i => i.state === 'waiting')).toBe(true);
    });

    it('when AsyncStorage.getItem rejects: getOutboxItems does not throw, addJobSteps rejects, setItem is NOT called; later call reads storage again and works (no lost queue)', async () => {
      const existingItem: OutboxItem = {
        id: 'pre-existing-1',
        courierId: 'rider-1',
        deliveryId: 'del-1',
        step: 'dispatched',
        tappedAt: 1000,
        state: 'waiting',
        restaurantName: 'R1',
      };
      await AsyncStorage.setItem(
        'jobStepOutbox',
        JSON.stringify([existingItem]),
      );

      resetOutboxForTests();

      const origGetItem = (
        AsyncStorage.getItem as jest.Mock
      ).getMockImplementation();

      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage read failure'),
      );
      (AsyncStorage.setItem as jest.Mock).mockClear();

      // 1. getOutboxItems does not throw
      expect(() => getOutboxItems()).not.toThrow();

      // 2. addJobSteps rejects
      await expect(
        addJobSteps([
          {
            courierId: 'rider-1',
            deliveryId: 'del-2',
            step: 'dispatched',
            tappedAt: 2000,
            restaurantName: 'R2',
          },
        ]),
      ).rejects.toThrow('Storage read failure');

      // 3. AsyncStorage.setItem is NOT called (stored queue is not overwritten with empty or new list)
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();

      // 4. A later call reads storage again and works
      (AsyncStorage.getItem as jest.Mock).mockImplementation(origGetItem);

      await addJobSteps([
        {
          courierId: 'rider-1',
          deliveryId: 'del-2',
          step: 'dispatched',
          tappedAt: 2000,
          restaurantName: 'R2',
        },
      ]);

      const items = getOutboxItems();
      expect(items).toHaveLength(2);
      expect(items[0].id).toBe('pre-existing-1');
      expect(items[1].deliveryId).toBe('del-2');
    });

    it('when AsyncStorage.setItem rejects: item is not in getOutboxItems afterwards', async () => {
      const origSetItem = (
        AsyncStorage.setItem as jest.Mock
      ).getMockImplementation();
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('Disk write failure'),
      );

      await expect(
        addJobSteps([
          {
            courierId: 'rider-1',
            deliveryId: 'del-write-fail',
            step: 'dispatched',
            tappedAt: 3000,
            restaurantName: 'R3',
          },
        ]),
      ).rejects.toThrow('Disk write failure');

      // Item was NOT assigned to memory because setItem failed
      const items = getOutboxItems();
      expect(items.some(i => i.deliveryId === 'del-write-fail')).toBe(false);

      (AsyncStorage.setItem as jest.Mock).mockImplementation(origSetItem);
    });
  });

  describe('Outbox sender (flushOutbox)', () => {
    it('sends oldest first, one at a time, only the given rider items (AC-8)', async () => {
      await addJobSteps([
        {
          courierId: 'other-rider',
          deliveryId: 'del-other',
          step: 'dispatched',
          tappedAt: 1000,
          restaurantName: 'Other',
        },
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'dispatched',
          tappedAt: 1100,
          restaurantName: 'R1',
        },
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'arrived_at_pickup',
          tappedAt: 1200,
          restaurantName: 'R1',
        },
      ]);

      const sentItems: OutboxItem[] = [];
      await flushOutbox('rider-1', async item => {
        sentItems.push(item);
        return {
          kind: 'delivery',
          status:
            item.step === 'dispatched'
              ? OrderStatus.dispatched
              : OrderStatus.courier_arrived_at_pickup_location,
        };
      });

      // Rider 1 items sent in oldest-first order
      expect(sentItems.map(i => i.step)).toEqual([
        'dispatched',
        'arrived_at_pickup',
      ]);
      expect(sentItems.every(i => i.courierId === 'rider-1')).toBe(true);

      // Other rider's waiting item is never sent and never removed (AC-8)
      const remaining = getOutboxItems();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].courierId).toBe('other-rider');
      expect(remaining[0].state).toBe('waiting');
    });

    it('sends tapAgeMs = now minus tappedAt, never negative', async () => {
      const now = 50000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      await addJobSteps([
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'dispatched',
          tappedAt: 45000, // 5000 ms ago
          restaurantName: 'R1',
        },
        {
          courierId: 'rider-1',
          deliveryId: 'del-2',
          step: 'dispatched',
          tappedAt: 60000, // Future clock (clock moved backward)
          restaurantName: 'R2',
        },
      ]);

      const agesRecorded: number[] = [];
      await flushOutbox('rider-1', async (_item, tapAgeMs) => {
        agesRecorded.push(tapAgeMs);
        return { kind: 'delivery', status: OrderStatus.dispatched };
      });

      expect(agesRecorded[0]).toBe(5000);
      expect(agesRecorded[1]).toBe(0); // Clamped to 0, never negative
    });

    it('stops at the first retry and leaves that item and the later ones waiting', async () => {
      await addJobSteps([
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'dispatched',
          tappedAt: 1000,
          restaurantName: 'R1',
        },
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'arrived_at_pickup',
          tappedAt: 1010,
          restaurantName: 'R1',
        },
      ]);

      let callCount = 0;
      await flushOutbox('rider-1', async () => {
        callCount++;
        return { kind: 'error', httpStatus: 503 }; // Server error -> retry
      });

      expect(callCount).toBe(1);
      const remaining = getOutboxItems();
      expect(remaining).toHaveLength(2);
      expect(remaining[0].state).toBe('waiting');
      expect(remaining[1].state).toBe('waiting');
    });

    it('a sent item is removed from storage and outbox', async () => {
      await addJobSteps([
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'dispatched',
          tappedAt: 1000,
          restaurantName: 'R1',
        },
      ]);

      expect(getOutboxItems()).toHaveLength(1);

      await flushOutbox('rider-1', async () => ({
        kind: 'delivery',
        status: OrderStatus.dispatched,
      }));

      expect(getOutboxItems()).toHaveLength(0);
      const raw = await AsyncStorage.getItem('jobStepOutbox');
      expect(JSON.parse(raw!)).toEqual([]);
    });

    it('a refused item becomes refused together with every later item of the same delivery and rider, and those later items are NOT sent, while items of other deliveries still are', async () => {
      await addJobSteps([
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'dispatched',
          tappedAt: 1000,
          restaurantName: 'R1',
        },
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'arrived_at_pickup',
          tappedAt: 1010,
          restaurantName: 'R1',
        },
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'picked_up',
          tappedAt: 1020,
          restaurantName: 'R1',
        },
        {
          courierId: 'rider-1',
          deliveryId: 'del-2',
          step: 'dispatched',
          tappedAt: 1030,
          restaurantName: 'R2',
        },
      ]);

      const sentSteps: string[] = [];
      await flushOutbox('rider-1', async item => {
        sentSteps.push(`${item.deliveryId}:${item.step}`);
        if (item.deliveryId === 'del-1') {
          // Refuse del-1 dispatched (e.g. 403)
          return { kind: 'error', httpStatus: 403 };
        }
        return { kind: 'delivery', status: OrderStatus.dispatched };
      });

      // del-1:dispatched was attempted and refused.
      // del-1:arrived_at_pickup and del-1:picked_up were NEVER sent!
      // del-2:dispatched WAS sent!
      expect(sentSteps).toEqual(['del-1:dispatched', 'del-2:dispatched']);

      const items = getOutboxItems();
      // del-1 items remain in outbox as 'refused'
      const del1Items = items.filter(i => i.deliveryId === 'del-1');
      expect(del1Items).toHaveLength(3);
      expect(del1Items.every(i => i.state === 'refused')).toBe(true);

      // del-2 item was sent and removed
      const del2Items = items.filter(i => i.deliveryId === 'del-2');
      expect(del2Items).toHaveLength(0);
    });

    it('stops before the next item when currentCourierId() no longer returns the item rider (AC-8)', async () => {
      await addJobSteps([
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'dispatched',
          tappedAt: 1000,
          restaurantName: 'R1',
        },
        {
          courierId: 'rider-1',
          deliveryId: 'del-1',
          step: 'arrived_at_pickup',
          tappedAt: 1010,
          restaurantName: 'R1',
        },
      ]);

      let activeRider: string | undefined = 'rider-1';
      const sentSteps: string[] = [];

      await flushOutbox(
        'rider-1',
        async item => {
          sentSteps.push(item.step);
          // Simulate rider logout or switch to a different courier before next step
          activeRider = 'rider-2';
          return { kind: 'delivery', status: OrderStatus.dispatched };
        },
        undefined,
        () => activeRider,
      );

      // Only the first step was sent
      expect(sentSteps).toEqual(['dispatched']);

      // The later item stays waiting and was not sent
      const remaining = getOutboxItems();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].step).toBe('arrived_at_pickup');
      expect(remaining[0].state).toBe('waiting');
    });
  });
});

import orderService from './orderService';
import { UClient } from './Client';

// Spec 0023 (AC-7): the restaurant's readyAt is moved onto the phone's clock
// with the job list's serverNow, beside the hand back window's end.
describe('getInProgressOrders attaches readyAtOnPhone (spec 0023, AC-7)', () => {
  const serverNow = '2026-11-03T12:00:00.000Z';
  const serverNowMs = Date.parse(serverNow);
  const readyAt = '2026-11-03T12:08:00.000Z'; // 8 min after serverNow
  const handBackUntil = '2026-11-03T12:01:00.000Z';
  const ROUND_TRIP = 2000;

  // A phone whose clock reads `phoneStart` when the request goes out.
  const fetchWithPhoneAt = async (phoneStart: number, jobs: unknown[]) => {
    let phoneTime = phoneStart;
    const dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => phoneTime);
    const get = jest.fn().mockImplementation(async () => {
      phoneTime += ROUND_TRIP;
      return { data: { result: { serverNow, data: jobs } } };
    });
    try {
      return await orderService({
        get,
      } as unknown as UClient).getInProgressOrders();
    } finally {
      dateSpy.mockRestore();
    }
  };

  it('a phone with the right time gets readyAt at the request midpoint plus the server gap', async () => {
    const orders = await fetchWithPhoneAt(serverNowMs, [
      { id: 'del-1', readyAt },
    ]);
    const midpoint = serverNowMs + ROUND_TRIP / 2;
    expect(orders[0].readyAtOnPhone).toBe(midpoint + 8 * 60 * 1000);
  });

  it('a phone 5 minutes fast still counts the right minutes to the ready time', async () => {
    const FAST = 5 * 60 * 1000;
    const orders = await fetchWithPhoneAt(serverNowMs + FAST, [
      { id: 'del-1', readyAt },
    ]);
    const phoneMidpoint = serverNowMs + FAST + ROUND_TRIP / 2;
    // On the phone's own (fast) clock the ready time is 5 min later than the
    // server's text says, so 8 minutes are still left, not 3.
    expect(orders[0].readyAtOnPhone).toBe(phoneMidpoint + 8 * 60 * 1000);
    expect(orders[0].readyAtOnPhone).not.toBe(Date.parse(readyAt));
    expect((orders[0].readyAtOnPhone! - phoneMidpoint) / 60000).toBe(8);
  });

  it('corrects readyAt and handBackUntil on the same job together', async () => {
    const FAST = 5 * 60 * 1000;
    const orders = await fetchWithPhoneAt(serverNowMs + FAST, [
      { id: 'del-1', readyAt, handBackUntil },
    ]);
    const phoneMidpoint = serverNowMs + FAST + ROUND_TRIP / 2;
    expect(orders[0].readyAtOnPhone).toBe(phoneMidpoint + 8 * 60 * 1000);
    expect(orders[0].handBackUntilOnPhone).toBe(phoneMidpoint + 60 * 1000);
    // The server's own fields travel unchanged.
    expect(orders[0].readyAt).toBe(readyAt);
    expect(orders[0].handBackUntil).toBe(handBackUntil);
  });

  it('leaves a job without readyAt untouched', async () => {
    const plain = { id: 'del-old', readyAt: null, foodReadyAt: null };
    const missing = { id: 'del-older' };
    const orders = await fetchWithPhoneAt(serverNowMs, [plain, missing]);
    expect(orders[0]).toEqual(plain);
    expect(orders[0]).not.toHaveProperty('readyAtOnPhone');
    expect(orders[1]).toEqual(missing);
    expect(orders[1]).not.toHaveProperty('readyAtOnPhone');
  });

  it('keeps foodReadyAt as sent', async () => {
    const orders = await fetchWithPhoneAt(serverNowMs, [
      { id: 'del-1', readyAt, foodReadyAt: '2026-11-03T11:59:00.000Z' },
    ]);
    expect(orders[0].foodReadyAt).toBe('2026-11-03T11:59:00.000Z');
  });
});

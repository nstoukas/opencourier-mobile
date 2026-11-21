import orderService from './orderService';
import { UClient } from './Client';
import { SplitRequest } from '@app/types/types';

// Spec 0047 (row 11): the two rider routes of a split at pickup, and the request's
// times moved onto the phone's clock when the job list arrives.
describe('orderService split endpoints (spec 0047, AC-1, AC-2, AC-8)', () => {
  const created: SplitRequest = {
    id: 'split-1',
    deliveryId: 'del-1',
    status: 'OPEN',
    proposedLegs: [{ boxSize: 'LARGE' }, { boxSize: 'SMALL' }],
    finalLegs: null,
    createdAt: '2026-11-21T12:00:00.000Z',
    leaveFrom: '2026-11-21T12:10:00.000Z',
    adminNote: null,
  };

  describe('sendSplitRequest (AC-1)', () => {
    it('POSTs deliveries/:id/split-requests with exactly { legs } and returns the created request', async () => {
      const post = jest
        .fn()
        .mockResolvedValue({ data: { error: false, result: created } });
      const service = orderService({ post } as unknown as UClient);

      const result = await service.sendSplitRequest({
        id: 'del-1',
        legs: [{ boxSize: 'LARGE' }, { boxSize: 'SMALL' }],
      });

      expect(post).toHaveBeenCalledTimes(1);
      const [path, body] = post.mock.calls[0];
      expect(path).toBe('deliveries/del-1/split-requests');
      // toEqual on the whole body: anything extra (a position, a rider id) fails.
      expect(body).toEqual({
        legs: [{ boxSize: 'LARGE' }, { boxSize: 'SMALL' }],
      });
      expect(result).toEqual(created);
    });

    it("lets the server's refusal through (the hook words it)", async () => {
      const refusal = new Error('409');
      const post = jest.fn().mockRejectedValue(refusal);
      const service = orderService({ post } as unknown as UClient);

      await expect(
        service.sendSplitRequest({ id: 'del-1', legs: [] }),
      ).rejects.toBe(refusal);
    });
  });

  describe('leaveSplit (AC-8)', () => {
    it('POSTs deliveries/:id/split-requests/leave with no body and returns the answer', async () => {
      const post = jest.fn().mockResolvedValue({
        data: { error: false, result: { status: 'LEFT' } },
      });
      const service = orderService({ post } as unknown as UClient);

      const result = await service.leaveSplit('del-1');

      expect(post).toHaveBeenCalledTimes(1);
      expect(post.mock.calls[0][0]).toBe(
        'deliveries/del-1/split-requests/leave',
      );
      expect(post.mock.calls[0][1]).toBeUndefined();
      expect(result).toEqual({ status: 'LEFT' });
    });

    it("lets the server's refusal through (409 before the limit)", async () => {
      const refusal = new Error('409');
      const post = jest.fn().mockRejectedValue(refusal);
      const service = orderService({ post } as unknown as UClient);

      await expect(service.leaveSplit('del-1')).rejects.toBe(refusal);
    });
  });

  describe("getInProgressOrders moves the request's times onto the phone's clock (cross check 12)", () => {
    const serverNow = '2026-11-21T12:04:00.000Z';

    // Answers the job list after a 2 second round trip on a phone whose clock reads `phoneStart`.
    const listWith = (phoneStart: number, jobs: unknown[]) => {
      let phoneTime = phoneStart;
      const dateSpy = jest
        .spyOn(Date, 'now')
        .mockImplementation(() => phoneTime);
      const get = jest.fn().mockImplementation(async () => {
        phoneTime += 2000;
        return { data: { result: { serverNow, data: jobs } } };
      });
      return { service: orderService({ get } as unknown as UClient), dateSpy };
    };

    it('gives the flag time and the leave time on the phone clock, right even when the phone is 5 minutes slow', async () => {
      const serverNowMs = new Date(serverNow).getTime();
      const phoneStart = serverNowMs - 5 * 60_000;
      const { service, dateSpy } = listWith(phoneStart, [
        { id: 'del-1', splitRequest: created },
      ]);

      try {
        const [job] = await service.getInProgressOrders();

        // The midpoint of the round trip is the phone time that matches the server's now.
        const midpoint = phoneStart + 1000;
        // The flag was 4 minutes before the server's now; leaving opens 6 minutes after it.
        expect(job.splitCreatedAtOnPhone).toBe(midpoint - 4 * 60_000);
        expect(job.splitLeaveFromOnPhone).toBe(midpoint + 6 * 60_000);
        // The request itself is passed on as it came.
        expect(job.splitRequest).toEqual(created);
      } finally {
        dateSpy.mockRestore();
      }
    });

    it('adds no split times to a job with no split request', async () => {
      const { service, dateSpy } = listWith(new Date(serverNow).getTime(), [
        { id: 'del-plain', splitRequest: null },
        { id: 'del-older-server' },
      ]);

      try {
        const jobs = await service.getInProgressOrders();
        for (const job of jobs) {
          expect(job.splitCreatedAtOnPhone).toBeUndefined();
          expect(job.splitLeaveFromOnPhone).toBeUndefined();
        }
      } finally {
        dateSpy.mockRestore();
      }
    });
  });
});

import reviewService, {
  ReviewService,
  SendReviewInput,
  REVIEW_PAGE_SIZE,
} from './reviewService';
import type { UClient } from './Client';
import {
  HowItWorks,
  PagedList,
  ReviewRequest,
  SettingChangeLine,
} from '@app/types/types';

describe('reviewService (spec 0038, AC-1, AC-8, AC-11, AC-13)', () => {
  let mockClient: jest.Mocked<UClient>;
  let service: ReviewService;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
    } as unknown as jest.Mocked<UClient>;

    service = reviewService(mockClient);
  });

  describe('sendReviewRequest (AC-1)', () => {
    it('calls POST review-requests with topic and note and returns result', async () => {
      const input: SendReviewInput = {
        topic: 'PAY',
        note: 'The wait time was not included in my pay.',
        deliveryId: 'del-123',
      };
      const mockResult: ReviewRequest = {
        id: 'rev-1',
        topic: 'PAY',
        note: input.note,
        status: 'OPEN',
        createdAt: '2026-11-19T10:00:00Z',
        dueAt: '2026-12-03T10:00:00Z',
        overdue: false,
        outcome: null,
        answer: null,
        answeredAt: null,
        withdrawnAt: null,
        correctionCents: null,
        correctionCurrency: null,
        delivery: {
          id: 'del-123',
          pickupName: 'Pizza Bistro',
          createdAt: '2026-11-19T09:00:00Z',
        },
      };

      mockClient.post.mockResolvedValueOnce({
        data: { result: mockResult },
      } as any);

      const result = await service.sendReviewRequest(input);

      expect(mockClient.post).toHaveBeenCalledWith('review-requests', input);
      expect(result).toEqual(mockResult);
    });

    it('sends general request without deliveryId', async () => {
      const input: SendReviewInput = {
        topic: 'OFFER',
        note: 'General question about order allocation.',
      };

      mockClient.post.mockResolvedValueOnce({
        data: { result: { id: 'rev-2', ...input, status: 'OPEN' } },
      } as any);

      const result = await service.sendReviewRequest(input);

      expect(mockClient.post).toHaveBeenCalledWith('review-requests', input);
      expect(result.id).toBe('rev-2');
    });
  });

  describe('getReviewRequests (AC-8)', () => {
    it('calls GET review-requests with page and perPage 20', async () => {
      const pagedResult: PagedList<ReviewRequest> = {
        data: [],
        pagination: { currentPage: 1, nextPage: 2, totalItems: 25 },
      };

      mockClient.get.mockResolvedValueOnce({
        data: { result: pagedResult },
      } as any);

      const result = await service.getReviewRequests(1);

      expect(mockClient.get).toHaveBeenCalledWith('review-requests', {
        params: { page: 1, perPage: REVIEW_PAGE_SIZE },
      });
      expect(result).toEqual(pagedResult);
    });
  });

  describe('withdrawReviewRequest (AC-8)', () => {
    it('calls POST review-requests/:id/withdraw and returns result', async () => {
      const withdrawn: ReviewRequest = {
        id: 'rev-1',
        topic: 'OTHER',
        note: 'Never mind',
        status: 'WITHDRAWN',
        createdAt: '2026-11-19T10:00:00Z',
        dueAt: '2026-12-03T10:00:00Z',
        overdue: false,
        outcome: null,
        answer: null,
        answeredAt: null,
        withdrawnAt: '2026-11-19T11:00:00Z',
        correctionCents: null,
        correctionCurrency: null,
        delivery: null,
      };

      mockClient.post.mockResolvedValueOnce({
        data: { result: withdrawn },
      } as any);

      const result = await service.withdrawReviewRequest('rev-1');

      expect(mockClient.post).toHaveBeenCalledWith(
        'review-requests/rev-1/withdraw',
      );
      expect(result).toEqual(withdrawn);
    });
  });

  describe('getHowItWorks (AC-11)', () => {
    it('calls GET how-it-works and returns the live explanation sentences', async () => {
      const howItWorksData: HowItWorks = {
        offers: [
          'Each order is offered to the nearest free rider who is Online.',
        ],
        pay: ['Base fee is €2.00 plus €0.50 per km.'],
        personDecides: [
          'Removals and account changes are decided by a person.',
        ],
        appRecords: ['A position only while Online or on a job.'],
        reviewAnswerDays: 14,
      };

      mockClient.get.mockResolvedValueOnce({
        data: { result: howItWorksData },
      } as any);

      const result = await service.getHowItWorks();

      expect(mockClient.get).toHaveBeenCalledWith('how-it-works');
      expect(result).toEqual(howItWorksData);
    });
  });

  describe('getSettingChanges (AC-13)', () => {
    it('calls GET setting-changes with page and perPage 20', async () => {
      const changesList: PagedList<SettingChangeLine> = {
        data: [
          {
            at: '2026-11-18T15:00:00Z',
            label: 'Base fee',
            oldText: '€1.80',
            newText: '€2.00',
          },
        ],
        pagination: { currentPage: 1, nextPage: null, totalItems: 1 },
      };

      mockClient.get.mockResolvedValueOnce({
        data: { result: changesList },
      } as any);

      const result = await service.getSettingChanges(1);

      expect(mockClient.get).toHaveBeenCalledWith('setting-changes', {
        params: { page: 1, perPage: REVIEW_PAGE_SIZE },
      });
      expect(result).toEqual(changesList);
    });
  });
});

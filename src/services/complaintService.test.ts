import complaintService, {
  ComplaintService,
  FileComplaintInput,
  COMPLAINT_PAGE_SIZE,
  COMPLAINT_PHOTO_MAX_BYTES,
} from './complaintService';
import type { UClient } from './Client';
import { Complaint, PagedList } from '@app/types/types';

// Spec 0052 (row 83): complaintService - filing (text and multipart photo), list, reply.
describe('complaintService (spec 0052, AC-2, AC-5, AC-9)', () => {
  let mockClient: jest.Mocked<UClient>;
  let service: ComplaintService;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
    } as unknown as jest.Mocked<UClient>;

    service = complaintService(mockClient);
  });

  describe('Constants', () => {
    it('sets max photo bytes to 5 MB', () => {
      expect(COMPLAINT_PHOTO_MAX_BYTES).toBe(5 * 1024 * 1024);
    });

    it('sets complaint page size to 20', () => {
      expect(COMPLAINT_PAGE_SIZE).toBe(20);
    });
  });

  describe('fileComplaint (AC-2, AC-9)', () => {
    it('sends JSON post without photo and unwraps result', async () => {
      const input: FileComplaintInput = {
        deliveryId: 'del-123',
        about: 'RESTAURANT',
        category: 'LONG_WAIT',
        text: 'Waited 30 minutes for food',
      };

      const mockResult: Complaint = {
        id: 'comp-1',
        role: 'FILED_BY_YOU',
        delivery: {
          id: 'del-123',
          pickupName: 'Souvlaki Bar',
          createdAt: '2026-11-20T10:00:00Z',
        },
        filedBy: 'RIDER',
        about: 'RESTAURANT',
        category: 'LONG_WAIT',
        text: input.text,
        hasPhoto: false,
        status: 'OPEN',
        createdAt: '2026-11-20T11:00:00Z',
        riderReply: null,
        repliedAt: null,
        replyEnteredForRider: false,
        outcome: null,
        decidedAt: null,
        withdrawnReason: null,
        withdrawnAt: null,
      };

      mockClient.post.mockResolvedValueOnce({
        data: { result: mockResult },
      } as any);

      const result = await service.fileComplaint(input);

      expect(mockClient.post).toHaveBeenCalledWith('complaints', {
        deliveryId: 'del-123',
        about: 'RESTAURANT',
        category: 'LONG_WAIT',
        text: 'Waited 30 minutes for food',
      });
      expect(result).toEqual(mockResult);
    });

    it('sends multipart/form-data with photo, 60s timeout, and unwraps result', async () => {
      const input: FileComplaintInput = {
        deliveryId: 'del-456',
        about: 'CUSTOMER',
        category: 'ABUSE_OR_THREAT',
        text: 'Customer was verbally abusive',
        photo: {
          uri: 'file:///data/user/0/com.opendeli/cache/photo.jpg',
          type: 'image/jpeg',
          name: 'photo.jpg',
        },
      };

      const mockResult: Complaint = {
        id: 'comp-2',
        role: 'FILED_BY_YOU',
        delivery: {
          id: 'del-456',
          pickupName: 'Burger House',
          createdAt: '2026-11-20T12:00:00Z',
        },
        filedBy: 'RIDER',
        about: 'CUSTOMER',
        category: 'ABUSE_OR_THREAT',
        text: input.text,
        hasPhoto: true,
        status: 'OPEN',
        createdAt: '2026-11-20T12:30:00Z',
        riderReply: null,
        repliedAt: null,
        replyEnteredForRider: false,
        outcome: null,
        decidedAt: null,
        withdrawnReason: null,
        withdrawnAt: null,
      };

      mockClient.post.mockResolvedValueOnce({
        data: { result: mockResult },
      } as any);

      const result = await service.fileComplaint(input);

      expect(mockClient.post).toHaveBeenCalledTimes(1);
      const [url, body, config] = mockClient.post.mock.calls[0];
      expect(url).toBe('complaints');
      expect(body).toBeInstanceOf(FormData);
      expect(config).toEqual({
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('getComplaints (AC-4, AC-7)', () => {
    it('calls GET complaints with page and perPage: 20', async () => {
      const pagedResult: PagedList<Complaint> = {
        data: [],
        pagination: { currentPage: 1, nextPage: 2, totalItems: 30 },
      };

      mockClient.get.mockResolvedValueOnce({
        data: { result: pagedResult },
      } as any);

      const result = await service.getComplaints(1);

      expect(mockClient.get).toHaveBeenCalledWith('complaints', {
        params: { page: 1, perPage: COMPLAINT_PAGE_SIZE },
      });
      expect(result).toEqual(pagedResult);
    });
  });

  describe('replyToComplaint (AC-5)', () => {
    it('calls POST complaints/:id/reply with text and unwraps result', async () => {
      const mockResult: Complaint = {
        id: 'comp-about-you',
        role: 'ABOUT_YOU',
        delivery: {
          id: 'del-789',
          pickupName: 'Taverna',
          createdAt: '2026-11-20T14:00:00Z',
        },
        filedBy: 'RESTAURANT',
        about: 'RIDER',
        category: 'LATE',
        text: 'Rider took too long',
        hasPhoto: false,
        status: 'OPEN',
        createdAt: '2026-11-20T14:30:00Z',
        riderReply: 'There was a road closure on Dimitriadis.',
        repliedAt: '2026-11-20T15:00:00Z',
        replyEnteredForRider: false,
        outcome: null,
        decidedAt: null,
        withdrawnReason: null,
        withdrawnAt: null,
      };

      mockClient.post.mockResolvedValueOnce({
        data: { result: mockResult },
      } as any);

      const result = await service.replyToComplaint(
        'comp-about-you',
        'There was a road closure on Dimitriadis.',
      );

      expect(mockClient.post).toHaveBeenCalledWith(
        'complaints/comp-about-you/reply',
        { text: 'There was a road closure on Dimitriadis.' },
      );
      expect(result).toEqual(mockResult);
    });
  });
});

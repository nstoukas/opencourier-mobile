import commentService from './commentService';
import { UClient } from './Client';

// Spec 0053 (AC-2, AC-4, AC-5, AC-7):
// commentService handles rider address notes API interactions:
// creating (with stop and optional confirmed), updating (with optional confirmed),
// deleting, toggleUpvote (UPVOTE reaction only, downvotes removed), and flagging.
describe('commentService (spec 0053)', () => {
  let mockClient: jest.Mocked<UClient>;

  beforeEach(() => {
    mockClient = {
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
    } as unknown as jest.Mocked<UClient>;
  });

  describe('createComment (AC-2, AC-4)', () => {
    it('posts to location-notes with deliveryId, stop and note', async () => {
      const service = commentService(mockClient);
      mockClient.post.mockResolvedValueOnce({
        error: false,
        data: { id: 'note-101' },
      });

      const result = await service.createComment({
        deliveryId: 'del-1',
        stop: 'DROPOFF',
        note: 'Dog in yard',
      });

      expect(mockClient.post).toHaveBeenCalledWith('location-notes', {
        deliveryId: 'del-1',
        stop: 'DROPOFF',
        note: 'Dog in yard',
      });
      expect(result).toEqual({ error: false, data: { id: 'note-101' } });
    });

    it('includes confirmed: true when rider confirms saving despite personal data warning', async () => {
      const service = commentService(mockClient);
      mockClient.post.mockResolvedValueOnce({ error: false });

      await service.createComment({
        deliveryId: 'del-2',
        stop: 'PICKUP',
        note: 'Call 6912345678',
        confirmed: true,
      });

      expect(mockClient.post).toHaveBeenCalledWith('location-notes', {
        deliveryId: 'del-2',
        stop: 'PICKUP',
        note: 'Call 6912345678',
        confirmed: true,
      });
    });

    it('propagates errors when API call fails', async () => {
      const service = commentService(mockClient);
      mockClient.post.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        service.createComment({
          deliveryId: 'del-3',
          stop: 'DROPOFF',
          note: 'Entrance on side',
        }),
      ).rejects.toThrow('Network error');
    });
  });

  describe('updateComment (AC-4, cross check 7)', () => {
    it('patches location-notes/:id with updated text', async () => {
      const service = commentService(mockClient);
      mockClient.patch.mockResolvedValueOnce({ error: false });

      await service.updateComment({
        id: 'note-123',
        note: 'Broken bell, knock instead',
      });

      expect(mockClient.patch).toHaveBeenCalledWith(
        'location-notes/note-123',
        { note: 'Broken bell, knock instead' },
      );
    });

    it('includes confirmed: true when editing with personal data override', async () => {
      const service = commentService(mockClient);
      mockClient.patch.mockResolvedValueOnce({ error: false });

      await service.updateComment({
        id: 'note-123',
        note: 'Ask for Maria',
        confirmed: true,
      });

      expect(mockClient.patch).toHaveBeenCalledWith(
        'location-notes/note-123',
        { note: 'Ask for Maria', confirmed: true },
      );
    });
  });

  describe('deleteComment (AC-2)', () => {
    it('deletes location-notes/:id', async () => {
      const service = commentService(mockClient);
      mockClient.delete.mockResolvedValueOnce({ error: false });

      await service.deleteComment('note-456');

      expect(mockClient.delete).toHaveBeenCalledWith('location-notes/note-456');
    });
  });

  describe('toggleUpvote (AC-5)', () => {
    it('posts reaction UPVOTE to location-notes/:id/react', async () => {
      const service = commentService(mockClient);
      mockClient.post.mockResolvedValueOnce({ ok: true });

      await service.toggleUpvote('note-789');

      expect(mockClient.post).toHaveBeenCalledWith(
        'location-notes/note-789/react',
        { reaction: 'UPVOTE' },
      );
    });
  });

  describe('flagComment (AC-7)', () => {
    it('posts to location-notes/:id/flag with empty body when reason is omitted', async () => {
      const service = commentService(mockClient);
      mockClient.post.mockResolvedValueOnce({ ok: true });

      await service.flagComment({ id: 'note-flag-1' });

      expect(mockClient.post).toHaveBeenCalledWith(
        'location-notes/note-flag-1/flag',
        {},
      );
    });

    it('posts reason when provided', async () => {
      const service = commentService(mockClient);
      mockClient.post.mockResolvedValueOnce({ ok: true });

      await service.flagComment({
        id: 'note-flag-2',
        reason: 'Contains phone number of customer',
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        'location-notes/note-flag-2/flag',
        { reason: 'Contains phone number of customer' },
      );
    });
  });
});

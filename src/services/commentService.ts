import { UClient } from './Client';
import { NewCommentParams, OrderServiceReponse } from './types';

// Spec 0053: the rider's notes about places (the backend's location-notes routes). Upvote is the
// only reaction (downvotes left the app), and a rider can flag a note for an admin.
export interface CommentService {
  createComment: (params: NewCommentParams) => Promise<OrderServiceReponse>;
  updateComment: (params: {
    id: string;
    note: string;
    confirmed?: boolean;
  }) => Promise<OrderServiceReponse>;
  deleteComment: (id: string) => Promise<OrderServiceReponse>;
  // A second upvote by the same rider takes it back.
  toggleUpvote: (locationNoteId: string) => Promise<unknown>;
  flagComment: (params: { id: string; reason?: string }) => Promise<unknown>;
}

const commentService = (client: UClient): CommentService => {
  const createComment = async (
    params: NewCommentParams,
  ): Promise<OrderServiceReponse> => {
    return client.post('location-notes', params);
  };

  const updateComment = async (params: {
    id: string;
    note: string;
    confirmed?: boolean;
  }): Promise<OrderServiceReponse> => {
    const { id, note, confirmed } = params;
    return client.patch(
      `location-notes/${id}`,
      confirmed ? { note, confirmed } : { note },
    );
  };
  const deleteComment = async (id: string): Promise<OrderServiceReponse> => {
    return client.delete(`location-notes/${id}`);
  };

  const toggleUpvote = async (locationNoteId: string) => {
    return client.post(`location-notes/${locationNoteId}/react`, {
      reaction: 'UPVOTE',
    });
  };

  const flagComment = async (params: { id: string; reason?: string }) => {
    return client.post(
      `location-notes/${params.id}/flag`,
      params.reason ? { reason: params.reason } : {},
    );
  };

  return {
    createComment,
    updateComment,
    deleteComment,
    toggleUpvote,
    flagComment,
  };
};

export default commentService;

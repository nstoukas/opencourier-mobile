import {
  HowItWorks,
  PagedList,
  ReviewRequest,
  ReviewTopic,
  SettingChangeLine,
} from '@app/types/types';
import { UClient } from './Client';

export type SendReviewInput = {
  topic: ReviewTopic;
  note: string;
  // Left out for a general request.
  deliveryId?: string;
};

export interface ReviewService {
  sendReviewRequest: (input: SendReviewInput) => Promise<ReviewRequest>;
  getReviewRequests: (page: number) => Promise<PagedList<ReviewRequest>>;
  withdrawReviewRequest: (id: string) => Promise<ReviewRequest>;
  getHowItWorks: () => Promise<HowItWorks>;
  getSettingChanges: (page: number) => Promise<PagedList<SettingChangeLine>>;
}

export const REVIEW_PAGE_SIZE = 20;

// Spec 0038: review requests, the explanation page and what changed. Every response is wrapped by
// the backend as { error, result }. The rider's note goes only to this route, never to a log.
const reviewService = (client: UClient): ReviewService => {
  const sendReviewRequest = async (
    input: SendReviewInput,
  ): Promise<ReviewRequest> => {
    const { data } = await client.post('review-requests', input);
    return data.result;
  };

  const getReviewRequests = async (
    page: number,
  ): Promise<PagedList<ReviewRequest>> => {
    const { data } = await client.get('review-requests', {
      params: { page, perPage: REVIEW_PAGE_SIZE },
    });
    return data.result;
  };

  const withdrawReviewRequest = async (id: string): Promise<ReviewRequest> => {
    const { data } = await client.post(`review-requests/${id}/withdraw`);
    return data.result;
  };

  const getHowItWorks = async (): Promise<HowItWorks> => {
    const { data } = await client.get('how-it-works');
    return data.result;
  };

  const getSettingChanges = async (
    page: number,
  ): Promise<PagedList<SettingChangeLine>> => {
    const { data } = await client.get('setting-changes', {
      params: { page, perPage: REVIEW_PAGE_SIZE },
    });
    return data.result;
  };

  return {
    sendReviewRequest,
    getReviewRequests,
    withdrawReviewRequest,
    getHowItWorks,
    getSettingChanges,
  };
};

export default reviewService;
